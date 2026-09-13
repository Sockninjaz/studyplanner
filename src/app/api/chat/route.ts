import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import * as google from 'googlethis';
import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import User from '@/models/User';
import ChatSession from '@/models/ChatSession';
import StudySession from '@/models/StudySession';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email }).select('+openai_api_key');
    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    const { messages, examId, aiIntegration, sessionId, parentMessageId, parentMessageContent } = await req.json();

    if (!examId) {
      return new Response('examId is required', { status: 400 });
    }

    const exam = await Exam.findById(examId);
    if (!exam || exam.user.toString() !== user._id.toString()) {
      return new Response('Exam not found or access denied', { status: 404 });
    }

    // Fetch all study sessions for this exam, sorted by startTime
    const studySessions = await StudySession.find({ exam: examId, user: user._id })
      .sort({ startTime: 1 })
      .lean();

    const now = new Date();
    const examDate = new Date(exam.date);

    // Active session lookup if sessionId is provided
    const activeSession = sessionId ? studySessions.find((s: any) => s._id.toString() === sessionId.toString()) : null;

    // Build a structured session schedule with task checklists for the prompt
    const sessionLines = studySessions.map((s: any, i: number) => {
      const start = new Date(s.startTime);
      const isCurrentActive = activeSession && s._id.toString() === activeSession._id.toString();
      const status = s.isCompleted
        ? '✅ Completed'
        : isCurrentActive
        ? '📍 CURRENT ACTIVE SESSION'
        : start <= now
        ? '⏰ Due / Overdue'
        : '📅 Upcoming';
      const dateStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
      const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      let line = `Session ${i + 1} [${status}] — ${dateStr} at ${timeStr}: "${s.title}"`;
      if (s.shortTitle && s.shortTitle !== s.title) {
        line += ` (Chapter: ${s.shortTitle})`;
      }

      // Format session tasks/checklist items as context for the AI
      const taskList: string[] = [];
      if (Array.isArray(s.tasks) && s.tasks.length > 0) {
        s.tasks.forEach((t: any) => {
          taskList.push(`    - [${t.completed ? 'x' : ' '}] ${t.text}`);
        });
      }
      if (Array.isArray(s.checklist) && s.checklist.length > 0) {
        s.checklist.forEach((c: any) => {
          taskList.push(`    - [${c.completed ? 'x' : ' '}] ${c.task}`);
        });
      }

      if (taskList.length > 0) {
        line += `\n    Tasks/Checklist:\n${taskList.join('\n')}`;
      }

      return line;
    });

    let activeSessionContext = '';
    if (activeSession) {
      const activeTasks: string[] = [];
      if (Array.isArray(activeSession.tasks) && activeSession.tasks.length > 0) {
        activeSession.tasks.forEach((t: any) => {
          activeTasks.push(`  - [${t.completed ? 'COMPLETED' : 'UNCOMPLETED / PENDING'}] ${t.text}`);
        });
      }
      if (Array.isArray(activeSession.checklist) && activeSession.checklist.length > 0) {
        activeSession.checklist.forEach((c: any) => {
          activeTasks.push(`  - [${c.completed ? 'COMPLETED' : 'UNCOMPLETED / PENDING'}] ${c.task}`);
        });
      }

      activeSessionContext = `\nCURRENT ACTIVE SESSION USER IS VIEWING / STUDYING:
- Session Title: "${activeSession.title}"
- Chapter / Topic: "${activeSession.shortTitle || activeSession.title}"
- Status: ${activeSession.isCompleted ? 'Completed' : 'In Progress / Upcoming'}
${activeTasks.length > 0 ? `- Tasks Checklist for THIS Session:\n${activeTasks.join('\n')}` : '- Tasks Checklist: None specified'}
CRITICAL MANDATE: The user has selected and opened THIS specific session ("${activeSession.title}"). All your tutoring, explanations, quiz questions, and guidance MUST focus on THIS session and its topics/tasks. Do NOT switch to today's session or a different session!\n`;
    }

    const completedCount = studySessions.filter((s: any) => s.isCompleted).length;
    const nextSession = studySessions.find((s: any) => !s.isCompleted);
    const targetSession = activeSession || nextSession || studySessions[0];
    const targetSessionTitle = targetSession ? `"${targetSession.title}"` : 'None';

    const nextSessionStr = nextSession
      ? `"${(nextSession as any).title}" on ${new Date((nextSession as any).startTime).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })}`
      : 'all sessions completed!';

    const daysUntilExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let materialContext = '';
    if (exam.useRag) {
      try {
        const lastUserMessage = messages[messages.length - 1]?.content || '';
        const { retrieveRelevantChunks } = await import('@/lib/rag/chunk-and-embed');
        const chunks = await retrieveRelevantChunks(lastUserMessage, exam._id.toString());
        
        if (chunks.length > 0) {
          materialContext = `\n\n---\nRELEVANT STUDY MATERIAL SECTIONS (Retrieved via RAG for large document):\n${chunks.map(c => `[${c.sectionTitle}]\n${c.text}`).join('\n\n')}\n---`;
        } else {
          // Fallback to a small slice of the beginning if nothing found
          materialContext = `\n\n---\nSTUDY MATERIAL (Initial context):\n${exam.rawMaterialText?.substring(0, 4000) || ''}\n---`;
        }
      } catch (err) {
        console.error('[RAG] Retrieval failed:', err);
        materialContext = `\n\n---\nSTUDY MATERIAL (Fallback context):\n${exam.rawMaterialText?.substring(0, 10000) || ''}\n---`;
      }
    } else if (exam.rawMaterialText) {
      materialContext = `\n\n---\nSTUDY MATERIAL (Full document injected):\n${exam.rawMaterialText.substring(0, 400000)}\n---`;
    }

    if (exam.subject.toLowerCase().includes('bio')) {
      try {
        const dbPath = require('path').join(process.cwd(), 'src', 'lib', 'biology-details.json');
        const fs = require('fs');
        if (fs.existsSync(dbPath)) {
          const biologyData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          let matchedChapter = null;
          let matchedLevel = '';
          const searchTitle = (targetSession?.shortTitle || targetSession?.title || '').toLowerCase();
          const userText = (messages[messages.length - 1]?.content || '').toLowerCase();
          
          // Determine student academic tier (vwo, havo, etc.)
          const studentTier = (
            user?.onboardingProfile?.academicTier || 
            (exam?.rawMaterialText?.toLowerCase().includes('vwo') ? 'vwo' : '') ||
            (exam?.rawMaterialText?.toLowerCase().includes('havo') ? 'havo' : '') ||
            'vwo'
          ).toLowerCase();

          // Sort levels to prioritize the student's tier
          const sortedLevels = Object.keys(biologyData).sort((a, b) => {
            const aIsTier = a.toLowerCase().includes(studentTier);
            const bIsTier = b.toLowerCase().includes(studentTier);
            if (aIsTier && !bIsTier) return -1;
            if (!aIsTier && bIsTier) return 1;
            return 0;
          });

          // Also prioritize matching textbook method if specified (e.g. "biologie voor jou")
          const examText = (exam?.rawMaterialText || '').toLowerCase();

          for (const level of sortedLevels) {
            const methods = Object.keys(biologyData[level]).sort((m1, m2) => {
              const m1Match = examText.includes(m1.toLowerCase());
              const m2Match = examText.includes(m2.toLowerCase());
              if (m1Match && !m2Match) return -1;
              if (!m1Match && m2Match) return 1;
              return 0;
            });

            for (const method of methods) {
              for (const chap of biologyData[level][method]) {
                if (chap.name.length < 3) continue;
                const chapNameClean = chap.name.toLowerCase().replace(/hoofdstuk \d+|thema \d+/gi, '').trim();
                const searchClean = searchTitle.replace(/hoofdstuk \d+|thema \d+/gi, '').trim();
                
                if (searchClean && (searchClean.includes(chapNameClean) || chapNameClean.includes(searchClean))) {
                  matchedChapter = chap;
                  matchedLevel = level;
                  break;
                }
                // If user explicitly asks about the chapter by name in their prompt (e.g. 'dna')
                if (userText.includes(chapNameClean)) {
                  matchedChapter = chap;
                  matchedLevel = level;
                  break;
                }
              }
              if (matchedChapter) break;
            }
            if (matchedChapter) break;
          }

          if (matchedChapter) {
            console.log(`[CHAT API] Biology DB match found: ${matchedLevel} -> ${matchedChapter.name}`);
            materialContext += `\n\n[BIOLOGIEPAGINA DATABASE MATCH]: Found exact curriculum data for ${matchedLevel} - chapter "${matchedChapter.name}". 
CRITICAL BOUNDARY RULE: The Glossary Definitions provided below define the ABSOLUTE MAXIMUM SCOPE of what the student needs to know for this chapter. If a biological concept (such as "leading strand", "lagging strand", "Okazaki-fragmenten", "primase", "topoisomerase") is NOT listed in the glossary below, IT IS NOT ON THEIR EXAM. You are FORBIDDEN from teaching it or quizzing them on it. Restrict your tutoring STRICTLY to the exact terms and definitions provided here.\n`;
            if (matchedChapter.subchapters && matchedChapter.subchapters.length > 0) {
               // Group and deduplicate by basisstof number
               const basisstofMap = new Map<string, { mainTitle: string; subTopics: string[] }>();
               
               for (const s of matchedChapter.subchapters) {
                 const match = s.match(/^(?:Bas|Basisstof)\s*(\d+)[:\s-]*(.*)$/i) || s.match(/^(\d+\.\d+)[:\s-]*(.*)$/i);
                 if (match) {
                   const num = match[1];
                   let raw = match[2].trim();
                   const isMedia = /\b(video|animatie|filmpje|fragment|virtueel|song)\b/i.test(raw);
                   const clean = raw
                     .replace(/^(video|animatie|filmpje|fragment)[:\s'"]*/gi, '')
                     .replace(/\((engels|aanrader|licht - donker)\)/gi, '')
                     .replace(/['"]/g, '')
                     .trim();
                   
                   if (!basisstofMap.has(num)) {
                     basisstofMap.set(num, { mainTitle: '', subTopics: [] });
                   }
                   const entry = basisstofMap.get(num)!;
                   if (!entry.mainTitle && !isMedia && clean.length > 2) {
                     entry.mainTitle = clean;
                   }
                   if (clean && clean.length > 2 && !entry.subTopics.includes(clean)) {
                     entry.subTopics.push(clean);
                   }
                 }
               }

               const consolidatedBasisstoffen: string[] = [];
               basisstofMap.forEach((data, num) => {
                 const title = data.mainTitle || data.subTopics[0] || `Onderwerp ${num}`;
                 consolidatedBasisstoffen.push(`Basisstof ${num}: ${title}`);
               });

               materialContext += `\nSubchapters (Basisstoffen):\n`;
               if (consolidatedBasisstoffen.length > 0) {
                 consolidatedBasisstoffen.forEach((b) => {
                   materialContext += `- ${b}\n`;
                 });
               } else {
                 matchedChapter.subchapters.forEach((s: string) => {
                   materialContext += `- ${s}\n`;
                 });
               }
            }
            if (matchedChapter.terms && matchedChapter.terms.length > 0) {
               materialContext += `\nGlossary Definitions (Begrippenlijst):\n`;
               matchedChapter.terms
                 .filter((t: any) => t.term && !t.term.includes('adsbygoogle') && !t.term.includes('window.') && t.term.trim().length > 1)
                 .forEach((t: any) => {
                    materialContext += `- ${t.term}: ${t.definition}\n`;
                 });
            }
          } else {
            console.log('[CHAT API] No Biology DB match found for:', searchTitle, 'or', userText);
          }
        }
      } catch (e) {
        console.error('Failed to load biology details:', e);
      }
    }

    const bioMatchActive = materialContext.includes('[BIOLOGIEPAGINA DATABASE MATCH]');
    const isSparseInput = !exam.useRag || (exam.rawMaterialText && exam.rawMaterialText.includes('Authentic Textbook Contents Found in Database:')) || (exam.rawMaterialText && exam.rawMaterialText.length < 500);
    
    if (isSparseInput) {
      materialContext += `\n\n[SYSTEM ALERT: SPARSE INPUT DETECTED]
The user did not upload a full document; they only provided a short title: "${exam.rawMaterialText ? exam.rawMaterialText.substring(0, 100) : ''}".
The study schedule above was automatically generated using their national curriculum profile. 
CRITICAL OVERRIDE: Because there is no uploaded text, you MUST act as the primary knowledge base. ${bioMatchActive ? 'HOWEVER, since a BIOLOGIEPAGINA DATABASE MATCH was found above, YOU MUST STRICTLY USE THE PROVIDED DEFINITIONS AND SUBCHAPTERS AS YOUR PRIMARY KNOWLEDGE BASE. DO NOT USE YOUR INTERNAL KNOWLEDGE FOR DEFINITIONS OR YOU WILL FAIL.' : 'Use your internal knowledge of the students national curriculum to teach the concepts listed in the study schedule.'} DO NOT complain that the text is missing.
TEXTBOOK SOURCE RULE: If the user asks what textbook or sources you are using, DO NOT invent fake textbook names (e.g., do not say "Scheikunde voor VWO"). Instead, honestly state: "I generated this study plan based on the official national curriculum guidelines and exam syllabus for your track and grade. I am not linked to a specific commercial textbook (like Chemie Overal or Nova), but the concepts I teach match the national exam requirements perfectly."`;
    }

    const bioTopDirective = bioMatchActive ? `
[ABSOLUTE CURRICULUM BOUNDARY DIRECTIVE — BIOLOGIEPAGINA.NL]:
You are tutoring a Dutch high school student on the curriculum chapter "${targetSession?.shortTitle || targetSession?.title || 'DNA'}".
1. GLOSSARY RULE: When the student asks for a glossary, begrippenlijst, or terms ("begrippen", "definities", etc.), you MUST ONLY output terms from the authentic "Glossary Definitions (Begrippenlijst)" section provided in your instructions below. Output the exact terms and definitions from that list. Do NOT add external terms.
2. BASISSTOFFEN RULE: When the student asks for the names or list of the basisstoffen ("wat zijn de basistoffen", "basisstof", "paragrafen", etc.), output a clean, numbered list with exactly ONE entry per basisstof (e.g. "Basisstof 1: Bouw DNA", "Basisstof 2: DNA Replicatie", etc.) based on the Subchapters list provided below. NEVER output duplicate basisstof numbers or individual video/fragment links.
3. STRICTLY FORBIDDEN: You are explicitly FORBIDDEN from mentioning or teaching out-of-scope non-curriculum concepts: "leading strand", "lagging strand", "okazaki-fragmenten", "topoisomerase", "primase". They are NOT on this high-school exam.
4. QUIZ & TESTING RULE: If quizzing or testing the student, ask ONLY questions about the basisstoffen and terms present in the database match below.
\n` : '';

    const systemMessage = `${bioTopDirective}You are an expert, proactive study coach and tutor for the student. Your role is like a personal teacher: you guide, quiz, explain, motivate, and keep the student on track. You are warm but structured — you take the lead when the student is ready to work.

EXAM DETAILS:
- Subject: "${exam.subject}"
- Exam date: ${examDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} (${daysUntilExam} days away)
- Progress: ${completedCount} of ${studySessions.length} sessions completed
${activeSession 
  ? `- CURRENTLY ACTIVE SESSION VIEWED BY USER: "${activeSession.title}" (Chapter: "${activeSession.shortTitle || activeSession.title}")` 
  : `- Next upcoming session: ${nextSessionStr}`}
${activeSessionContext}
FULL STUDY SCHEDULE:
${sessionLines.length > 0 ? sessionLines.join('\n') : 'No sessions scheduled yet.'}

${user.onboardingProfile ? `STUDENT ACADEMIC PROFILE:
- Country: ${user.onboardingProfile.countryName || 'Unknown'}
- Academic Track: ${user.onboardingProfile.academicTierLabel || 'Unknown'}
- Grade/Year: ${user.onboardingProfile.gradeLabel || 'Unknown'}
- Exam Board: ${user.onboardingProfile.examBoardLabel || 'N/A'}

BEHAVIORAL RULE - PROFILE ANCHORING:
Instruct the AI model to automatically anchor its vocabulary, conceptual complexity, tone, and exam-tool references (e.g., pointing out specific national formula sheets like BINAS tables for Dutch VWO science students, or specific guidelines for UK A-Levels) directly to this profile tier. Do not over-explain low-level foundational concepts unless explicitly asked, and do not cross into advanced university-level mechanics.

${exam.subject.toLowerCase().includes('bio') && user.onboardingProfile?.countryName === 'Netherlands' && !bioMatchActive ? `
SPECIAL BIOLOGY RULE (NETHERLANDS):
The user is studying Dutch Biology. When teaching, explaining concepts, or referencing material not explicitly provided, heavily rely on your internal knowledge of the website 'biologiepagina.nl' and the standard textbooks 'Biologie voor Jou' (BVJ) or 'Nectar'. These sources are the golden standard for the Dutch curriculum. Structure your explanations according to these sources.` : ''}
` : ''}
YOUR BEHAVIOUR RULES:
1. LANGUAGE: Detect the language of the uploaded study material and respond in that same language throughout the entire conversation. If the material is in Dutch, speak Dutch. If in English, speak English — and so on. ONLY switch language if the student explicitly asks you to (e.g. "can you explain in English?").
2. PROACTIVE LEAD (CRITICAL): When the student says something like "let's work", "let's start", "help me study", "ready", "laten we beginnen", or similar — immediately take the lead on the ${activeSession ? 'CURRENTLY ACTIVE SESSION ("' + activeSession.title + '")' : 'next session (' + targetSessionTitle + ')'}. DO NOT assume they are working on today's session if they selected a different session! Introduce the specific topic of this session, explain what they should focus on, give a brief overview of key concepts, then start quizzing or guiding interactively based on its assigned tasks. Do NOT just give instructions — actually start teaching.
3. SESSION FOCUS: Always align your tutoring strictly with the session the student is currently viewing/asking about (${activeSession ? '"' + activeSession.title + '"' : targetSessionTitle}).
4. CHECK UNDERSTANDING: After explaining a concept, ask a question to check understanding. Wait for their response before moving on.
5. PREREQUISITE FLEXIBILITY: If the student doesn't understand a prerequisite concept needed for the current topic, give a short, clear explanation of that prerequisite and move forward. Do NOT stay stuck on it indefinitely — the goal is to get the student to understand the current session's topic. Note any gaps to revisit at the end.
6. OVERDUE SESSIONS: If the student is behind or has overdue sessions, acknowledge it supportively and help them catch up efficiently. Prioritise the most important content.
7. CITATIONS — ALWAYS follow this rule: Whenever you explain a concept, mention which section of the uploaded material it comes from. For example: "Volgens § 9.1..." or "According to § 9.1...". If you cannot identify the exact section, say "Based on the material..." Do this for every substantive explanation.
${bioMatchActive 
  ? `8. CURRICULUM KNOWLEDGE BASE & GLOSSARY (MANDATORY ENFORCEMENT):
A verified curriculum database match from biologiepagina.nl is active in your instructions. You MUST use those exact definitions and subchapters. DO NOT use your internal general knowledge to invent or introduce terms outside the provided glossary. Specifically, "leading strand", "lagging strand", and "helicase" are completely forbidden.`
  : (isSparseInput 
      ? `8. CURRICULUM KNOWLEDGE BASE: The student provided sparse material, so you must use your internal knowledge of their national curriculum to answer questions. DO NOT say "it is not in the material." Instead, confidently teach them the subject matter based on the scheduled topics.`
      : `8. NO HALLUCINATION — CRITICAL: If a student asks a question that is NOT covered in the uploaded material, you MUST state clearly: "Jouw materiaal behandelt dit niet specifiek, maar in het algemeen..." (or in the detected language: "Your material does not specify this, but generally..."). Never present external knowledge as if it were in the material. This keeps the student focused on what will actually be on their exam.`)}
9. ACTIVE LEARNING: Propose active learning techniques: flashcard-style Q&A, short recall tests, concept explanations, "teach it back to me" exercises, and summary challenges.
10. ENCOURAGEMENT: Be encouraging but honest — if they get something wrong, correct them clearly and explain why.
11. FOCUS: If the student asks a question about the material, answer it thoroughly but bring them back to the session work afterwards.
12. TASK-FOCUSED TUTORING & DIRECTION: You have full visibility into the tasks/checklist for each study session (e.g. \`- [ ] Review formula X\`, \`- [ ] Solve 5 practice problems\`). Use these tasks to proactively push the student in a clear direction! When guiding the student through a session, reference their specific tasks, guide them step-by-step through completing the uncompleted tasks (\`[ ]\`), quiz them on each task item, and encourage them to tick off tasks as they master them.${materialContext}`;

    const selectedModelName = isSparseInput ? 'gpt-4o' : (aiIntegration === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini');
    
    try {
       require('fs').writeFileSync(require('path').join(process.cwd(), 'debug-system-message.txt'), systemMessage);
    } catch (e) {
       console.error('Failed to write debug log');
    }

    // BYOK Logic: Use user's key if available, otherwise fallback to standard system openai client
    let model;
    if (user.openai_api_key) {
      const customOpenAI = createOpenAI({ apiKey: user.openai_api_key });
      model = customOpenAI(selectedModelName);
    } else {
      model = openai(selectedModelName);
    }

    // Fetch existing chat session to give OpenAI full context across all sessions
    const existingChat = await ChatSession.findOne({ exam: examId }).lean();
    const existingMessages = existingChat ? existingChat.messages.map((m: any) => ({ role: m.role, content: m.content })) : [];
    const userMessage = messages[messages.length - 1];

    // Sanitize past messages so previous hallucinations don't poison LLM context
    const sanitizedHistory = existingMessages.map((m: any) => {
      if (bioMatchActive && m.role === 'assistant' && typeof m.content === 'string') {
        return {
          ...m,
          content: m.content
            .replace(/leading strand[^\n]*/gi, '')
            .replace(/lagging strand[^\n]*/gi, '')
            .replace(/okazaki[^\n]*/gi, '')
        };
      }
      return m;
    });

    const overrideMessages: any[] = [];
    if (bioMatchActive) {
      const userText = (userMessage?.content || '').toLowerCase();
      const isGlossaryQuery = /begrip|definitie|term|lijst|woorden/i.test(userText);
      const isBasisstoffenQuery = /basisstof|basistoffen|paragraaf|paragrafen/i.test(userText);
      if (isGlossaryQuery) {
        overrideMessages.push({
          role: 'system' as const,
          content: `CRITICAL REAL-TIME OVERRIDE: The user is asking for the chapter glossary ("${userMessage.content}"). You MUST output the terms and definitions from the "Glossary Definitions (Begrippenlijst)" section in your instructions. Do NOT include terms that are not in that list (such as "leading strand", "lagging strand", "okazaki"). Output the authentic list directly and comprehensively.`
        });
      } else if (isBasisstoffenQuery) {
        overrideMessages.push({
          role: 'system' as const,
          content: `CRITICAL REAL-TIME OVERRIDE: The user is asking for the names of the basisstoffen ("${userMessage.content}"). You MUST output a clean, numbered list of each distinct basisstof once (e.g., Basisstof 1: ..., Basisstof 2: ..., etc.) using the Subchapters list in your instructions. Do NOT repeat basisstof numbers multiple times and do NOT output video or animation clip names.`
        });
      } else {
        overrideMessages.push({
          role: 'system' as const,
          content: `CRITICAL REAL-TIME OVERRIDE: Restrict all explanations and quiz questions strictly to the provided curriculum database for this chapter.`
        });
      }
    }
    
    let fullMessagesToAI;
    let parentMessageObj: any = null;

    if (parentMessageId && existingChat) {
      parentMessageObj = existingChat.messages.find((m: any) => m._id.toString() === parentMessageId);
      
      if (!parentMessageObj && parentMessageContent) {
        // Fallback for newly generated messages that don't have a real MongoDB _id yet on the frontend
        parentMessageObj = existingChat.messages.find((m: any) => m.role === 'assistant' && m.content.trim() === parentMessageContent.trim());
      }

      if (!parentMessageObj) {
        return new Response('Parent message not found', { status: 404 });
      }
      
      const parentIndex = existingChat.messages.findIndex((m: any) => m._id.toString() === parentMessageObj._id.toString());
      const mainHistory = sanitizedHistory.slice(0, parentIndex + 1);
      
      const threadInstruction = {
        role: 'system' as const,
        content: `INLINE THREAD CONTEXT: The user is now asking a specific follow-up question about your last response. Focus entirely on explaining, clarifying, or answering based on that specific response.`
      };

      const inlineHistory = (parentMessageObj.inlineChats || []).map((m: any) => ({ role: m.role, content: m.content }));
      
      fullMessagesToAI = [
        ...mainHistory,
        threadInstruction,
        ...inlineHistory,
        ...overrideMessages,
        { role: userMessage.role as 'user', content: userMessage.content }
      ];
    } else {
      fullMessagesToAI = [
        ...sanitizedHistory,
        ...overrideMessages,
        { role: userMessage.role as 'user', content: userMessage.content }
      ];
    }

    const result = streamText({
      model,
      system: systemMessage,
      messages: fullMessagesToAI,
    });

    // Save chat in background after stream completes
    (async () => {
      try {
        const fullText = await result.text;
        let chatSession = await ChatSession.findOne({ exam: examId });
        
        const userMessageData = { 
          ...messages[messages.length - 1], 
          ...(sessionId && { studySession: sessionId }) 
        };
        
        const assistantMessageData = { 
          role: 'assistant', 
          content: fullText, 
          createdAt: new Date(),
          ...(sessionId && { studySession: sessionId }) 
        };

        if (!chatSession) {
          chatSession = new ChatSession({
            user: user._id,
            exam: exam._id,
            aiIntegration: aiIntegration || 'openai',
            messages: [userMessageData, assistantMessageData],
          });
        }
        
        if (parentMessageId) {
          // Add to inlineChats array of the specific parent message
          await ChatSession.updateOne(
            { _id: chatSession._id, 'messages._id': parentMessageId },
            {
              $push: {
                'messages.$.inlineChats': {
                  $each: [
                    { role: 'user', content: userMessageData.content, createdAt: new Date() },
                    { role: 'assistant', content: fullText, createdAt: new Date() }
                  ]
                }
              }
            }
          );
        } else {
          chatSession.messages.push(userMessageData);
          chatSession.messages.push(assistantMessageData);
          await chatSession.save();
        }
      } catch (err) {
        console.error('[chat] Failed to save session:', err);
      }
    })();

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

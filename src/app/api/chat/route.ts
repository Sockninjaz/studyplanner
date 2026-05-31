import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { openai } from '@ai-sdk/openai';
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

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    const { messages, examId, aiIntegration } = await req.json();

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

    // Build a structured session schedule for the prompt
    const sessionLines = studySessions.map((s: any, i: number) => {
      const start = new Date(s.startTime);
      const status = s.isCompleted
        ? '✅ Completed'
        : start <= now
        ? '⏰ Due / Overdue'
        : '📅 Upcoming';
      const dateStr = start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
      const timeStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return `Session ${i + 1} [${status}] — ${dateStr} at ${timeStr}: "${s.title}"`;
    });

    const completedCount = studySessions.filter((s: any) => s.isCompleted).length;
    const nextSession = studySessions.find((s: any) => !s.isCompleted);
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
      materialContext = `\n\n---\nSTUDY MATERIAL (Full document injected):\n${exam.rawMaterialText.substring(0, 18000)}\n---`;
    }

    const isSparseInput = exam.rawMaterialText && exam.rawMaterialText.length < 100;
    
    if (isSparseInput) {
      materialContext += `\n\n[SYSTEM ALERT: SPARSE INPUT DETECTED]
The user did not upload a full document; they only provided a short title: "${exam.rawMaterialText}".
The study schedule above was automatically generated using their national curriculum profile. 
CRITICAL OVERRIDE: Because there is no uploaded text, you MUST act as the primary knowledge base. Use your internal knowledge of the student's national curriculum to teach the concepts listed in the study schedule. DO NOT complain that the text is missing.
TEXTBOOK SOURCE RULE: If the user asks what textbook or sources you are using, DO NOT invent fake textbook names (e.g., do not say "Scheikunde voor VWO"). Instead, honestly state: "I generated this study plan based on the official national curriculum guidelines and exam syllabus for your track and grade. I am not linked to a specific commercial textbook (like Chemie Overal or Nova), but the concepts I teach match the national exam requirements perfectly."`;
    }

    const systemMessage = `You are an expert, proactive study coach and tutor for the student. Your role is like a personal teacher: you guide, quiz, explain, motivate, and keep the student on track. You are warm but structured — you take the lead when the student is ready to work.

EXAM DETAILS:
- Subject: "${exam.subject}"
- Exam date: ${examDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} (${daysUntilExam} days away)
- Progress: ${completedCount} of ${studySessions.length} sessions completed
- Next session: ${nextSessionStr}

FULL STUDY SCHEDULE:
${sessionLines.length > 0 ? sessionLines.join('\n') : 'No sessions scheduled yet.'}

${user.onboardingProfile ? `STUDENT ACADEMIC PROFILE:
- Country: ${user.onboardingProfile.countryName || 'Unknown'}
- Academic Track: ${user.onboardingProfile.academicTierLabel || 'Unknown'}
- Grade/Year: ${user.onboardingProfile.gradeLabel || 'Unknown'}
- Exam Board: ${user.onboardingProfile.examBoardLabel || 'N/A'}

BEHAVIORAL RULE - PROFILE ANCHORING:
Instruct the AI model to automatically anchor its vocabulary, conceptual complexity, tone, and exam-tool references (e.g., pointing out specific national formula sheets like BINAS tables for Dutch VWO science students, or specific guidelines for UK A-Levels) directly to this profile tier. Do not over-explain low-level foundational concepts unless explicitly asked, and do not cross into advanced university-level mechanics.
` : ''}
YOUR BEHAVIOUR RULES:
1. LANGUAGE: Detect the language of the uploaded study material and respond in that same language throughout the entire conversation. If the material is in Dutch, speak Dutch. If in English, speak English — and so on. ONLY switch language if the student explicitly asks you to (e.g. "can you explain in English?").
2. PROACTIVE LEAD: When the student says something like "let's work", "let's start", "help me study", "ready", "laten we beginnen", or similar — immediately take the lead. Jump straight into the next incomplete session. Introduce the topic, explain what they should focus on, give a brief overview of key concepts, then start quizzing or guiding interactively. Do NOT just give instructions — actually start teaching.
3. SCHEDULE AWARENESS: Always know where the student is in the schedule. Reference specific session titles and dates.
4. CHECK UNDERSTANDING: After explaining a concept, ask a question to check understanding. Wait for their response before moving on.
5. PREREQUISITE FLEXIBILITY: If the student doesn't understand a prerequisite concept needed for the current topic, give a short, clear explanation of that prerequisite and move forward. Do NOT stay stuck on it indefinitely — the goal is to get the student to understand the current session's topic. Note any gaps to revisit at the end.
6. OVERDUE SESSIONS: If the student is behind or has overdue sessions, acknowledge it supportively and help them catch up efficiently. Prioritise the most important content.
7. CITATIONS — ALWAYS follow this rule: Whenever you explain a concept, mention which section of the uploaded material it comes from. For example: "Volgens § 9.1..." or "According to § 9.1...". If you cannot identify the exact section, say "Based on the material..." Do this for every substantive explanation.
${isSparseInput 
  ? `8. CURRICULUM KNOWLEDGE BASE: The student provided sparse material, so you must use your internal knowledge of their national curriculum to answer questions. DO NOT say "it's not in the material." Instead, confidently teach them the subject matter based on the scheduled topics.`
  : `8. NO HALLUCINATION — CRITICAL: If a student asks a question that is NOT covered in the uploaded material, you MUST state clearly: "Jouw materiaal behandelt dit niet specifiek, maar in het algemeen..." (or in the detected language: "Your material doesn't specify this, but generally..."). Never present external knowledge as if it were in the material. This keeps the student focused on what will actually be on their exam.`}
9. ACTIVE LEARNING: Propose active learning techniques: flashcard-style Q&A, short recall tests, concept explanations, "teach it back to me" exercises, and summary challenges.
10. ENCOURAGEMENT: Be encouraging but honest — if they get something wrong, correct them clearly and explain why.
11. FOCUS: If the student asks a question about the material, answer it thoroughly but bring them back to the session work afterwards.
12. WEB SEARCH TOOL: If the user asks for information you don't have, or specifically asks to search the web (e.g. for a textbook's Table of Contents or a recent event), you have access to a web search tool. Use it to find accurate, up-to-date information before answering.${materialContext}`;

    // If sparse input, force the smarter GPT-4o model because it needs maximum internal knowledge to tutor without a document
    const selectedModelName = isSparseInput ? 'gpt-4o' : (aiIntegration === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini');
    const model = openai(selectedModelName);

    const result = streamText({
      model,
      system: systemMessage,
      messages,
      // @ts-ignore
      maxSteps: 3,
      // @ts-ignore
      tools: {
        searchWeb: tool({
          description: 'Search the web using Google to find real-time information, textbook table of contents, or anything not covered in the local material.',
          parameters: z.object({
            query: z.string().describe('The search query (e.g. "Chemie Overal 5 VWO table of contents" or "bol.com Chemie Overal 5 VWO inhoudsopgave")'),
          }),
          // @ts-ignore
          execute: async ({ query }) => {
            try {
              const options = {
                page: 0,
                safe: false,
                additional_params: { hl: 'en' }
              };
              const response = await google.search(query, options);
              const results = response.results.slice(0, 3).map((r: any) => ({
                title: r.title,
                snippet: r.description,
                url: r.url
              }));
              return JSON.stringify(results);
            } catch (err) {
              console.error('[searchWeb] failed:', err);
              return JSON.stringify({ error: 'Search failed' });
            }
          },
        }),
      },
    });

    // Save chat in background after stream completes
    (async () => {
      try {
        const fullText = await result.text;
        let chatSession = await ChatSession.findOne({ exam: examId });
        const userMessage = messages[messages.length - 1];
        const assistantMessage = { role: 'assistant', content: fullText, createdAt: new Date() };

        if (!chatSession) {
          chatSession = new ChatSession({
            user: user._id,
            exam: exam._id,
            aiIntegration: aiIntegration || 'openai',
            messages: [userMessage, assistantMessage],
          });
        } else {
          chatSession.messages.push(userMessage);
          chatSession.messages.push(assistantMessage);
        }
        await chatSession.save();
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

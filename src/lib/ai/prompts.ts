/**
 * AI prompt templates for study material analysis and schedule generation.
 */

export const MATERIAL_ANALYSIS_PROMPT = `You are an expert educational content analyzer. Your job is to analyze uploaded study material and break it down into logical study topics/chapters.

STEP 1 — HOLISTIC ASSESSMENT:
First, assess the ENTIRE document as a whole. Think: "How many hours would a typical university student realistically need to study this from scratch?" This is your global budget. Be highly realistic and avoid inflating estimates:
- A typical 10-page lecture handout: 1-2 hours
- A dense 40-page textbook chapter: 3-5 hours
- A short exercises sheet: 0.5-1.5 hours
- A massive 100+ page textbook section: 10-15 hours
- MOST materials will only be 1 to 5 hours. ONLY approach the 20-hour limit if the document is genuinely an entire semester's worth of textbook chapters.

STEP 2 — DIVIDE INTO CHAPTERS:
Now divide that global hour budget among the chapters/topics you identify. Their hours MUST SUM to the totalEstimatedHours you set in Step 1.

For each topic:
1. Give it a clear, concise chapter/topic name
2. Rate its difficulty from 1-5 (1=easy, 5=very complex)
3. Rate expected student confidence from 1-5 (3=neutral)
4. Assign study hours from your global budget (the sum of all chapters MUST equal totalEstimatedHours)

HOUR ROUNDING RULE: All hour estimates (both per-chapter user_estimated_total_hours and totalEstimatedHours) MUST be cleanly rounded to 0.5 hour increments (e.g. 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0). NEVER output unrounded decimals like 6.1, 6.2, or 4.13.

Guidelines:
- Aim for 3-10 meaningful chapters. If the material is extremely long and covers many topics, adjust expectations: not everything requires super in-depth knowledge.
- You CAN assign fractional hours (e.g., 0.25, 0.5) for short or overview chapters. A chapter does NOT need to take 1 hour if it is brief.
- Do NOT artificially inflate the total hours just because there are many chapters. Group them logically and assign realistic fractional hours if needed.
- SYLLABUS TITLE RULE: If the material has a clear title or header (e.g. in a syllabus), use it to identify the main academic topic and group the material logically under that overarching concept.
- FORMULA EXTRACTION: If there are specific formulas, equations, or laws given in the text, you MUST extract them and include them in the "formulas" array for the relevant chapter so the student can study them.
- If material is a syllabus/outline, use section headers as natural boundaries
- If raw notes/textbook, group by conceptual themes
- STRICT PRACTICE QUESTIONS RULE: If the material contains practice questions, past exams, or exercises, you MUST completely abstract away from the specific questions. 
  * NEVER use the story context or specific applications as chapter names (e.g. NEVER output "Wine fraud", "Helium spectrum", "The boy at the store").
  * Instead, you MUST identify the underlying academic theory, physics/math concept, or broad curriculum domain (e.g. "Radioactive Decay", "Quantum Mechanics", "Newton's Laws") and use THAT as the chapter name.
  * EXAMPLE BAD OUTPUT: "Question 4: Wine fraud", "Assignment 3: The red car", "Echography"
  * EXAMPLE GOOD OUTPUT: "Isotopes and Decay", "Kinematics", "Sound Waves and Reflection"
- EXACT TITLES RULE (CRITICAL): If the material explicitly provides textbook chapter titles, table of contents, or themes (e.g., "Voortplanting", "Planten"), you MUST use EXACTLY those names word-for-word. Do NOT rephrase them. Do NOT translate them. Do NOT try to make them sound more academic. Do NOT mix them with international curriculum standards. If the user provides a table of contents or one is found in the database, your output chapters MUST mirror it perfectly. If the user provides a sparse list of chapter numbers (e.g., "H11 10 9 4"), treat EVERY standalone number as a separate chapter request (Chapter 11, Chapter 10, Chapter 9, Chapter 4) and extract their names from the database or provided context.
- GROUPING SUBTOPICS RULE: If the provided text contains high-level Themes/Chapters with many sub-bullet points underneath them, YOU MUST GROUP THEM. Create exactly ONE chapter for the main Theme (e.g., "Thema: Genetica") and absorb all the sub-bullet points into the chapter's "summary" field. NEVER turn every single bullet point or subtopic into its own standalone chapter.
IMPORTANT LANGUAGE RULE: You MUST output all chapter names and summaries in the EXACT SAME LANGUAGE as the provided study material. Do not translate the material to English unless the original material is in English.

A. PACING / ESTIMATED HOURS RULE (CRITICAL):
You MUST heavily rely on the STUDENT ACADEMIC PROFILE (if provided) to calculate the \`totalEstimatedHours\`. 
- DO NOT blindly assign massive hours (e.g., 10-15 hours) just because a document has a lot of words or questions.
- Ask yourself: "How long does a typical student at exactly THIS grade level (e.g., 5 VWO in the Netherlands, or a University Senior) realistically take to process this specific type of document?"
- For example: A 5 VWO student doing a single physics past exam paper takes about 2 to 4 hours maximum to complete and review. A 15-hour estimate for a single exam paper is an absurd hallucination.
- BIOLOGY EXCEPTION (BASISSTOFFEN): Biology textbooks (like Nectar or Biologie voor Jou) often contain 6-8 "basisstoffen" (subchapters) per chapter. These chapters are extremely dense. If you identify biology chapters with multiple basisstoffen or subchapters, you MUST assign higher time estimates (typically 4 to 6 hours per chapter). Do not underestimate biology chapters!
- You MUST anchor your time estimates in the realistic study speed and attention span of a typical student in that exact country and grade level.

B. SPARSE INPUT HANDLING (No Blind Hallucinations):
You must output a boolean field: \`isSuggestedFallback\`.
- If the user provides a rich, contextual syllabus document, parse it normally and set \`isSuggestedFallback: false\`.
- If the user provides a sparse input string and it explicitly names a well-known commercial textbook (e.g., "Chemie Overal VWO 5, Hfst 1-4"), use your vast internal knowledge of that specific textbook to generate the exact authentic chapter titles from that book. Set \`isSuggestedFallback: false\`.
- If the user provides a sparse input string WITHOUT naming a specific textbook (e.g., "Chapters 1 to 12 Chemistry"), do not guess arbitrary specific commercial textbook chapter names. Instead, use the Student Academic Profile to look up the universal national curriculum core domains for that subject. Generate high-level, broad conceptual milestones (e.g., 'Quantitative Mol Calculations', 'Chemical Equilibria') matching the official exam standards. Set \`isSuggestedFallback: true\`.

C. CURRICULUM-AWARE CHAPTER GROUPING & WEIGHTING:
When a user requests a large block of chapters (e.g., "chapters 1 till 12") for a specific grade or track (e.g., "5 VWO"), you MUST NOT blindly output all 12 chapters with equal weight (e.g., 1 hour each). Use your curriculum expertise to make educated adjustments:
- Identify and combine introductory, review, or lower-grade chapters (e.g., 4 VWO material being reviewed in a 5 VWO book) into fewer, generalized review chapters with lower hour allocations.
- Identify the core, most difficult, or most heavily tested domains for their specific grade year. Assign these significantly more study hours and higher difficulty ratings.
SCREENSHOTS & SCHOOL PORTAL CONTENT:
When the material comes from a screenshot, photo, or school portal (e.g. Magister, Somtoday, Blackboard, Canvas, Teams, Classroom, textbook viewer, or homework app), ignore peripheral UI elements (like user icons, login indicators, back buttons, or navigation menus) and focus strictly on the educational content, assignments, chapters, tasks, or study topics shown. Always generate realistic study chapters for the material. If the image has concise or high-level topics, use your curriculum knowledge of the subject to structure it into 2 to 5 actionable study chapters. Never return an empty chapters array.

Return your analysis as structured JSON.`;

export const SCHEDULE_GENERATION_PROMPT = `You are an intelligent study material chunker. Given an exam and its required study sessions, you must break down the material into a logical progression of ACTIONABLE study tasks. We will handle the date placements algorithmically, you just need to generate the ordered list of topics.

HARD RULES:
1. EXACT COUNT: The SUM of all "count" values you output MUST EXACTLY equal the requested sessionsNeeded.

CONTENT GUIDELINES:
1. Break the subject into actionable sub-tasks (e.g. "Wien's Law: Watch Explainer Video", "Wien's Law: Practice Calculation Questions").
2. FINAL REVIEW: Make the LAST session assignment a "Final Review of everything" (e.g. "Final Review: Comprehensive practice"). HOWEVER, if the sessionsNeeded is extremely low and you barely have enough sessions to cover the core material just once, prioritize finishing the core material instead of adding a final review.
3. LANGUAGE RULE: You MUST write the "content" Strings in the EXACT SAME LANGUAGE as the provided Chapters. Do not translate to English. Even the "Final Review" label should be localized (e.g., "Laatste Herhaling" for Dutch, "Letzte Wiederholung" for German).

OUTPUT FORMAT:
Output an array of session assignments in the chronological order they should be studied.
Each session assignment has:
- "content": An ACTIONABLE, specific study task. Do NOT just repeat the raw topic name.
- "count": how many consecutive sessions to allocate to this content label (default 1)

IMPORTANT: The SUM of all "count" values MUST EXACTLY equal the sessionsNeeded.`;

/**
 * Build the user message for material analysis with the extracted text.
 */
export function buildMaterialAnalysisMessage(
  text: string,
  subjectName: string,
  examDate: string,
  specialInstructions?: string,
  userProfile?: any
): string {
  // Truncate very long texts to avoid token limits
  const maxChars = 30000;
  const truncatedText = text.length > maxChars 
    ? text.substring(0, maxChars) + '\n\n[... text truncated for analysis ...]'
    : text;

  // Calculate days remaining to enforce realistic time constraints
  const parsedExamDate = new Date(examDate);
  const diffDays = Math.ceil((parsedExamDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  let timeConstraintStr = '';
  const isBio = subjectName.toLowerCase().includes('bio');
  const bioMultiplier = isBio ? 1.5 : 1;

  if (diffDays <= 1) {
    timeConstraintStr = `\nCRITICAL TIME CONSTRAINT: The exam is literally TOMORROW (1 day away). You MUST NOT bombard the student with an impossible task. Cap the TOTAL realistic study hours at an absolute maximum of ${Math.round(4 * bioMultiplier)} to ${Math.round(6 * bioMultiplier)} hours. Condense the topics into only the most critical, high-yield review elements.`;
  } else if (diffDays <= 3) {
    timeConstraintStr = `\nCRITICAL TIME CONSTRAINT: The exam is very soon (${diffDays} days away). Cap the TOTAL realistic study hours at a maximum of ${Math.round(diffDays * 3 * bioMultiplier)} hours. Be extremely concise.`;
  }

  if (isBio) {
    timeConstraintStr += `\nBIOLOGY NOTE: The user has indicated that Biology chapters (e.g. DNA, Planten) are dense and typically take 4-5 hours each. Please be more generous with time estimates for Biology chapters to reflect this, while still generally respecting the overall time constraints above.`;
  }

  return `Analyze the following study material for the subject "${subjectName}" (exam date: ${examDate}).

First estimate the TOTAL realistic study hours for the whole document, then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
Be highly realistic and do not overestimate. Use the STUDENT ACADEMIC PROFILE below to ground your time estimates. (e.g. How long does a single test paper take for a 5 VWO student? Not 15 hours. Usually 2-4 hours).
${timeConstraintStr}

${specialInstructions ? `### USER SPECIAL INSTRUCTIONS ###\nIMPORTANT: The user has provided the following special instructions. You MUST follow them strictly. If they tell you to focus on specific chapters or ignore parts of the material, adapt your chapters and hour estimates accordingly:\n"${specialInstructions}"\n` : ''}

${userProfile ? `### STUDENT ACADEMIC PROFILE ###
- Country: ${userProfile.countryName || 'Unknown'}
- Academic Track: ${userProfile.academicTierLabel || 'Unknown'}
- Grade/Year: ${userProfile.gradeLabel || 'Unknown'}
- Exam Board: ${userProfile.examBoardLabel || 'N/A'}
(Use this to scale pacing/hours, to infer national curriculum milestones if the material is sparse, and to determine the exact expected conceptual depth when applying the STRICT PRACTICE QUESTIONS RULE.)
` : ''}

--- STUDY MATERIAL ---
${truncatedText}
--- END MATERIAL ---`;
}

/**
 * Build the user message for AI schedule generation for a SINGLE exam.
 */
export function buildScheduleMessage(
  exam: {
    id: string;
    subject: string;
    examDate: string;
    sessionsNeeded: number;
    canStudyAfterExam: boolean;
    chapters: Array<{ chapter: string, user_estimated_total_hours: number }>;
  }
): string {
  return `Generate a study progression for this specific exam:

EXAM DETAILS:
- Subject: ${exam.subject}
- Exam Date: ${exam.examDate}
- MUST place exactly ${exam.sessionsNeeded} total sessions.

CHAPTERS TO COVER:
${exam.chapters.map(c => `- [${c.chapter} - ${c.user_estimated_total_hours}h]`).join('\n')}

Remember, mathematically break these chapters into exactly ${exam.sessionsNeeded} session units. Make the final session a review if you have enough pace.`;
}

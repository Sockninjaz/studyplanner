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

Guidelines:
- Aim for 3-10 meaningful chapters. If the material is extremely long and covers many topics, adjust expectations: not everything requires super in-depth knowledge.
- You CAN assign fractional hours (e.g., 0.25, 0.5) for short or overview chapters. A chapter does NOT need to take 1 hour if it is brief.
- Do NOT artificially inflate the total hours just because there are many chapters. Group them logically and assign realistic fractional hours if needed.
- If material is a syllabus/outline, use section headers as natural boundaries
- If raw notes/textbook, group by conceptual themes
- STRICT PRACTICE QUESTIONS RULE: If the material contains practice questions, past exams, or exercises, you MUST completely abstract away from the specific questions. 
  * NEVER use story titles or specific applications as chapter names (e.g. NEVER output "Wijnfraude opsporen", "Geïoniseerd helium", "Emissienevel", "Echografie", "The boy at the store").
  * Instead, you MUST identify the broad national curriculum domain being tested and use THAT as the chapter name (e.g. "Straling en Gezondheid" (Radiation & Health), "Atoomfysica" (Atomic Physics), "Mechanica", "Stoichiometry").
  * Treat the questions merely as a diagnostic tool to figure out which high-level syllabus topics the student needs to learn. Output ONLY those high-level academic concepts.
IMPORTANT LANGUAGE RULE: You MUST output all chapter names and summaries in the EXACT SAME LANGUAGE as the provided study material. Do not translate the material to English unless the original material is in English.

A. PACING / ESTIMATED HOURS RULE:
Scale the \`totalEstimatedHours\` using an implicit friction multiplier tied to the student's academic level (if provided in their Academic Profile). Younger students or high-stakes tracks (e.g., Dutch VWO Upper Years, German Abitur, UK A-Levels) must receive a higher baseline allocation of study hours broken down into smaller, highly actionable focus chunks than a university senior processing the same density of text.

B. SPARSE INPUT HANDLING (No Blind Hallucinations):
You must output a boolean field: \`isSuggestedFallback\`.
- If the user provides a rich, contextual syllabus document, parse it normally and set \`isSuggestedFallback: false\`.
- If the user provides a sparse input string and it explicitly names a well-known commercial textbook (e.g., "Chemie Overal VWO 5, Hfst 1-4"), use your vast internal knowledge of that specific textbook to generate the exact authentic chapter titles from that book. Set \`isSuggestedFallback: false\`.
- If the user provides a sparse input string WITHOUT naming a specific textbook (e.g., "Chapters 1 to 12 Chemistry"), do not guess arbitrary specific commercial textbook chapter names. Instead, use the Student Academic Profile to look up the universal national curriculum core domains for that subject. Generate high-level, broad conceptual milestones (e.g., 'Quantitative Mol Calculations', 'Chemical Equilibria') matching the official exam standards. Set \`isSuggestedFallback: true\`.

GATED CONTENT GUARDRAIL:
If the provided text looks like a login page, a cookie consent wall, an "Access Denied" error, or purely generic website junk (Terms of Service, Privacy Policy, Login) WITHOUT any actual educational or study-related material, do NOT generate study chapters. Instead, return exactly ONE chapter named "FILE_ERROR_GATED" and in the "summary" explain that the provided source appears to be a protected or restricted page that the AI cannot read.

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

  return `Analyze the following study material for the subject "${subjectName}" (exam date: ${examDate}).

First estimate the TOTAL realistic study hours for the whole document, then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
Be highly realistic and do not overestimate. Most single documents only take 1-5 hours to study.

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

/**
 * AI prompt templates for study material analysis and schedule generation.
 */

export const MATERIAL_ANALYSIS_PROMPT = `You are an expert educational content analyzer. Your job is to analyze uploaded study material and break it down into logical study topics/chapters.

STEP 1 — HOLISTIC ASSESSMENT & REALISTIC HOUR BUDGETING:
First, assess the ENTIRE document as a whole, anchored in the STUDENT ACADEMIC PROFILE (their country, academic tier, and exact grade year).
Study hour recommendations must be realistic, motivating, and manageable for a high school / secondary student. NEVER overwhelm the student with inflated or impossible study budgets like 20-30 hours for a single exam!

Realistic Exam Preparation Guidelines:
- UPPER-SECONDARY EXAM YEARS (e.g. Klas 6 VWO, Klas 5 HAVO, Grade 12, Senior High):
  Students are preparing for school exams (SE) or national exams (CE). They need focused, high-yield preparation.
  * Target a total of 6 to 9 hours of study time for the exam (typically 1.5 to 2.5 hours per core chapter/domain).
  * Only for exceptionally large, multi-book comprehensive exams should the total ever reach 10-12 hours.
  * NEVER suggest 20-30 hours for an exam! 24 hours is far too long and demoralizing for high school exam preparation.
- MID UPPER-SECONDARY (e.g. Klas 4-5 VWO, Klas 4 HAVO, Grade 10-11):
  * Target 4 to 7 hours of study time total (1.0 to 2.0 hours per chapter).
- LOWER SECONDARY (e.g. Klas 1-3, Grades 7-9):
  * Target 2 to 5 hours of study time total (0.5 to 1.5 hours per chapter).

STEP 2 — DIVIDE INTO CHAPTERS:
Now divide that global hour budget among the chapters/topics you identify. Their hours MUST SUM to the totalEstimatedHours you set in Step 1.

For each topic:
1. Give it a clear, concise academic chapter/topic name.
2. Rate its difficulty from 1-5 (1=easy, 5=very complex).
3. Rate expected student confidence from 1-5 (3=neutral).
4. Assign study hours from your global budget (the sum of all chapters MUST equal totalEstimatedHours).

HOUR ROUNDING RULE: All hour estimates (both per-chapter user_estimated_total_hours and totalEstimatedHours) MUST be cleanly rounded to 0.5 hour increments (e.g. 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0). NEVER output unrounded decimals like 6.1, 6.2, or 4.13.

CRITICAL RULE 1 — PRACTICE QUESTIONS, EXAM PAPERS & EXERCISE SETS:
Students frequently upload past exams, practice questions, or exercise problem sets (e.g. Centraal Examen / Schoolexamen opgaven, practice tests, worksheet problems).
Exam questions in modern curricula (especially Dutch VWO/HAVO CE/SE, IB, AP) ALWAYS wrap questions in real-world narrative scenarios and applications (e.g., "Wijnfraude" [Wine fraud / C-14 decay], "Nuclidetherapie" [Targeted alpha radiation therapy], "Echografie" [Ultrasound impedance], "Auto botsing" [Car collision], "Fietsdynamo" [Bicycle dynamo], "Speelgoedraket" [Toy rocket]).

When practice questions, past exams, or exercises are uploaded:
1. NEVER create a chapter for each individual question/opgave. An exam paper with 5 questions is NOT 5 chapters!
2. NEVER use question story titles, case scenarios, or real-world application flavor text in chapter names.
   - STRICTLY FORBIDDEN: "Wijnfraude", "Wijnfraude en Radioactieve Isotopen", "Nuclidetherapie en Alfastralers", "Echografie en Akoestische Weerstand", "Opgave 1: ...", "Vraag 2".
   - Under NO circumstances may narrative scenario keywords (e.g. "Wijnfraude", "Nuclidetherapie", "Fietsdynamo", "Speelgoed", "Wijn") appear in chapter names! The student is studying physics/chemistry/biology curriculum, NOT wine fraud!
3. ABSTRACT INTO CORE ACADEMIC SYLLABUS DOMAINS:
   You MUST look through the questions to identify the underlying academic curriculum concepts being tested, and group them into 2 to 4 overarching textbook/syllabus chapters.
   - For example:
     * Questions testing C-14 decay in vintage wine ("Wijnfraude") and alpha decay in cancer therapy ("Nuclidetherapie") both test the exact same curriculum topic: "Kernfysica en Radioactiviteit" (or "Radioactiviteit en Ioniserende Straling"). You MUST merge them into ONE chapter: "Kernfysica en Radioactiviteit"!
     * A question testing ultrasound reflections and acoustic impedance in tissue ("Echografie") tests: "Medische Beeldvorming".
   - Chapter names MUST be 100% academic textbook/curriculum domain titles in the material's language (e.g. in Dutch for Dutch material: "Kernfysica en Radioactiviteit", "Medische Beeldvorming", "Mechanica", "Elektriciteit").
4. REALISTIC TIME FOR PRACTICE SETS:
   Studying/practicing for an exam based on a set of practice questions typically requires 4 to 8 hours of total study time (around 1.5 to 2.5 hours per tested domain), NEVER 20+ hours!

CRITICAL RULE 2 — EXACT TITLES ONLY FOR REAL TEXTBOOK TABLES OF CONTENTS:
The rule to copy exact titles word-for-word ONLY applies when the text contains an authentic textbook Table of Contents, syllabus outline, or book chapter list (e.g. "Hoofdstuk 4: Zuren en Basen", "Thema: Genetica").
It strictly DOES NOT apply to question/opgave titles, exercise headings, or problem numbers in tests or practice sets. Question headers (e.g. "Opgave 3: Wijnfraude") must NEVER be used as chapter titles.

General Guidelines:
- Aim for 2-5 meaningful chapters for a standard exam.
- You CAN assign fractional hours (e.g., 0.5, 1.0, 1.5, 2.0) for concise review or overview chapters.
- FORMULA EXTRACTION: If there are specific formulas, equations, or laws given in the text, you MUST extract them and include them in the "formulas" array for the relevant chapter so the student can study them.
- GROUPING SUBTOPICS: If the provided text contains high-level Themes/Chapters with many sub-bullet points underneath them, YOU MUST GROUP THEM into the main Theme. NEVER turn every single bullet point or subtopic into its own standalone chapter.
- IMPORTANT LANGUAGE RULE: You MUST output all chapter names and summaries in the EXACT SAME LANGUAGE as the provided study material. Do not translate Dutch material to English.

SCREENSHOTS & SCHOOL PORTAL CONTENT:
When the material comes from a screenshot, photo, or school portal (e.g. Magister, Somtoday, Blackboard, Canvas, Teams, Classroom, textbook viewer, or homework app), ignore peripheral UI elements and focus strictly on the educational content, assignments, chapters, tasks, or study topics shown. Always generate realistic study chapters for the material (typically 2 to 4 chapters).

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
  const bioMultiplier = isBio ? 1.25 : 1;

  if (diffDays <= 1) {
    timeConstraintStr = `\nCRITICAL TIME CONSTRAINT: The exam is literally TOMORROW (1 day away). You MUST NOT bombard the student with an impossible task. Cap the TOTAL realistic study hours at an absolute maximum of ${Math.round(4 * bioMultiplier)} to ${Math.round(5 * bioMultiplier)} hours. Condense the topics into only the most critical, high-yield review elements.`;
  } else if (diffDays <= 3) {
    timeConstraintStr = `\nCRITICAL TIME CONSTRAINT: The exam is very soon (${diffDays} days away). Cap the TOTAL realistic study hours at a maximum of ${Math.round(diffDays * 2.5 * bioMultiplier)} hours. Be concise.`;
  }

  // Detect if the uploaded material contains practice questions / exam exercises
  const isPracticeExam = /(?:opgave|vraag)\s*\d+|centraal\s*examen|schoolexamen|toetsvraag|oefenexamen|oefentoets|examenopgave/i.test(text);
  let practiceExamNotice = '';
  if (isPracticeExam) {
    practiceExamNotice = `
### DETECTED PRACTICE QUESTIONS / EXAM MATERIAL ###
Notice: The provided material contains practice questions, exam tasks (opgaven), or test exercises.
1. DO NOT create a chapter for each question! Group all questions into 2 to 4 core academic syllabus domains (e.g. "Kernfysica en Radioactiviteit", "Medische Beeldvorming").
2. FORBIDDEN CHAPTER NAMES: Do NOT use question story scenarios or application contexts in chapter names (e.g. NEVER "Wijnfraude", "Nuclidetherapie", "Echografie bij...", "Wijnfraude en ...", "Opgave 1"). Output 100% academic curriculum domain titles.
3. STUDY HOURS: Suggest a realistic, focused total of 5 to 8 hours for practicing/revising these exam questions. DO NOT suggest 20+ hours!
`;
  }

  const gradeStr = userProfile?.gradeLabel || userProfile?.grade || '';
  const trackStr = userProfile?.academicTierLabel || userProfile?.academicTier || '';
  const isUpperSecondary = /6|5|12|11|bovenbouw|senior|vwo|havo/i.test(gradeStr + ' ' + trackStr);

  return `Analyze the following study material for the subject "${subjectName}" (exam date: ${examDate}).

First estimate the TOTAL realistic study hours for the whole document, then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
${timeConstraintStr}
${practiceExamNotice}

${specialInstructions ? `### USER SPECIAL INSTRUCTIONS ###
IMPORTANT: The user has provided the following special instructions. You MUST follow them strictly. If they tell you to focus on specific chapters or ignore parts of the material, adapt your chapters and hour estimates accordingly:
"${specialInstructions}"\n` : ''}

${userProfile ? `### STUDENT ACADEMIC PROFILE & YEAR ###
- Country: ${userProfile.countryName || 'Netherlands'}
- Academic Track: ${userProfile.academicTierLabel || 'VWO'}
- Current Grade / Year: ${userProfile.gradeLabel || 'Klas 6'} (${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || '6'})
- Exam Board: ${userProfile.examBoardLabel || 'National Curriculum (Centraal Examen / Schoolexamen)'}

MANDATORY PACING INSTRUCTION FOR THIS GRADE:
The student is in ${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || 'Klas 6'}.
${isUpperSecondary ? 
`This student is in UPPER SECONDARY / FINAL EXAM YEAR (${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || '6'}) in ${userProfile.countryName || 'the Netherlands'}!
- Target a realistic and manageable total of 6 to 9 hours of study time for the exam (typically 1.5 to 2.5 hours per core domain/chapter).
- DO NOT suggest 20-30 hours! 24 hours is far too much studying for a high school exam. Keep the total study hours motivating, manageable, and realistically achievable (typically 6 to 9 hours total, or 4 to 8 hours for practice question sets).` : 
`Calibrate pacing and hour allocations realistically for ${userProfile.academicTierLabel || ''} ${userProfile.gradeLabel || ''}. Target a realistic total of 4 to 7 hours for the exam.`}
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

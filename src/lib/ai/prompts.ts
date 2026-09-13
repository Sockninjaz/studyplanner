/**
 * AI prompt templates for study material analysis and schedule generation.
 */

export const MATERIAL_ANALYSIS_PROMPT = `You are an expert educational content analyzer. Your job is to analyze uploaded study material and break it down into logical study topics/chapters.

STEP 1 — HOLISTIC ASSESSMENT & GRADE-LEVEL SCALING:
First, assess the ENTIRE document as a whole, specifically anchored in the STUDENT ACADEMIC PROFILE (their country, academic tier, and exact grade year).
Academic study requirements scale significantly by school year:
- UPPER-SECONDARY EXAM YEARS (e.g. Klas 6 VWO, Klas 5 HAVO, Grade 12, Senior High):
  Students are preparing for high-stakes, cumulative national/school exams (Centraal Examen / Schoolexamen). Tests cover deep conceptual domains and complex practice problems.
  * Allocate 3.5 to 6.0 hours per major chapter (e.g., dense biology chapters with 5-8 basisstoffen like DNA or Planten, or calculus/physics chapters, take 4 to 6 hours each!).
  * An exam covering 2-4 chapters realistically requires 10 to 20+ hours of total study time.
- MID UPPER-SECONDARY (e.g. Klas 4-5 VWO, Klas 4 HAVO, Grade 10-11):
  * Allocate 2.5 to 4.5 hours per chapter. Exams typically require 6 to 12 hours total.
- LOWER SECONDARY (e.g. Klas 1-3, Grades 7-9):
  * Shorter introductory chapters: 1.0 to 2.5 hours per chapter. Tests typically require 3 to 6 hours total.

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
- You CAN assign fractional hours (e.g., 0.5, 1.0) for short review or overview chapters.
- Do NOT artificially compress study hours down to 1 hour if the student is in upper secondary / exam years (e.g. 5-6 VWO) studying major textbook chapters.
- SYLLABUS TITLE RULE: If the material has a clear title or header (e.g. in a syllabus), use it to identify the main academic topic and group the material logically under that overarching concept.
- FORMULA EXTRACTION: If there are specific formulas, equations, or laws given in the text, you MUST extract them and include them in the "formulas" array for the relevant chapter so the student can study them.
- If material is a syllabus/outline, use section headers as natural boundaries
- If raw notes/textbook, group by conceptual themes
- STRICT PRACTICE QUESTIONS RULE: If the material contains practice questions, past exams, or exercises, you MUST completely abstract away from the specific questions. 
  * NEVER use the story context or specific applications as chapter names (e.g. NEVER output "Wine fraud", "Helium spectrum", "The boy at the store").
  * Instead, you MUST identify the underlying academic theory, physics/math concept, or broad curriculum domain (e.g. "Radioactive Decay", "Quantum Mechanics", "Newton's Laws") and use THAT as the chapter name.
- EXACT TITLES RULE (CRITICAL): If the material explicitly provides textbook chapter titles, table of contents, or themes (e.g., "Voortplanting", "Planten"), you MUST use EXACTLY those names word-for-word. Do NOT rephrase them. Do NOT translate them. Do NOT try to make them sound more academic. Do NOT mix them with international curriculum standards. If the user provides a table of contents or one is found in the database, your output chapters MUST mirror it perfectly. If the user provides a sparse list of chapter numbers (e.g., "H11 10 9 4"), treat EVERY standalone number as a separate chapter request (Chapter 11, Chapter 10, Chapter 9, Chapter 4) and extract their names from the database or provided context.
- GROUPING SUBTOPICS RULE: If the provided text contains high-level Themes/Chapters with many sub-bullet points underneath them, YOU MUST GROUP THEM. Create exactly ONE chapter for the main Theme (e.g., "Thema: Genetica") and absorb all the sub-bullet points into the chapter's "summary" field. NEVER turn every single bullet point or subtopic into its own standalone chapter.
IMPORTANT LANGUAGE RULE: You MUST output all chapter names and summaries in the EXACT SAME LANGUAGE as the provided study material. Do not translate the material to English unless the original material is in English.

A. PACING / ESTIMATED HOURS RULE (CRITICAL):
You MUST heavily rely on the STUDENT ACADEMIC PROFILE (if provided) to calculate the \`totalEstimatedHours\`. 
- Scale time according to the student's exact grade and track: A student in 6 VWO preparing for an exam on 2-3 dense science/math chapters needs 8 to 18 hours of study, whereas a 1st or 2nd year student needs 2 to 4 hours.
- BIOLOGY EXCEPTION (BASISSTOFFEN): Biology textbooks (like Nectar or Biologie voor Jou) contain 5-8 dense "basisstoffen" per chapter. For upper-level students (HAVO 4-5, VWO 4-6), each biology chapter requires 4.0 to 6.0 hours of study. Do not underestimate biology chapters!
- You MUST anchor your time estimates in the realistic study speed and attention span of a typical student in that exact country, track, and grade level.

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

  const gradeStr = userProfile?.gradeLabel || userProfile?.grade || '';
  const trackStr = userProfile?.academicTierLabel || userProfile?.academicTier || '';
  const isUpperSecondary = /6|5|12|11|bovenbouw|senior|vwo|havo/i.test(gradeStr + ' ' + trackStr);

  return `Analyze the following study material for the subject "${subjectName}" (exam date: ${examDate}).

First estimate the TOTAL realistic study hours for the whole document, then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
${timeConstraintStr}

${specialInstructions ? `### USER SPECIAL INSTRUCTIONS ###\nIMPORTANT: The user has provided the following special instructions. You MUST follow them strictly. If they tell you to focus on specific chapters or ignore parts of the material, adapt your chapters and hour estimates accordingly:\n"${specialInstructions}"\n` : ''}

${userProfile ? `### STUDENT ACADEMIC PROFILE & YEAR ###
- Country: ${userProfile.countryName || 'Netherlands'}
- Academic Track: ${userProfile.academicTierLabel || 'VWO'}
- Current Grade / Year: ${userProfile.gradeLabel || 'Klas 6'} (${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || '6'})
- Exam Board: ${userProfile.examBoardLabel || 'National Curriculum (Centraal Examen / Schoolexamen)'}

MANDATORY PACING INSTRUCTION FOR THIS GRADE:
The student is in ${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || 'Klas 6'}.
${isUpperSecondary ? 
`This student is in UPPER SECONDARY / FINAL EXAM YEAR (${userProfile.academicTierLabel || 'VWO'} ${userProfile.gradeLabel || '6'}) in ${userProfile.countryName || 'the Netherlands'}!
- Tests at this level (SE / CE) are high-stakes and cover dense, multi-topic syllabus units.
- Allocate realistic study hours: each dense chapter (like DNA, Planten, or advanced topics) requires 3.5 to 6.0 hours of study time.
- An exam with multiple major chapters should realistically receive 8 to 18+ hours of total study time.
- Do NOT artificially deflate hours down to 1-2 hours for a senior secondary exam.` : 
`Calibrate pacing and hour allocations realistically for ${userProfile.academicTierLabel || ''} ${userProfile.gradeLabel || ''}.`}
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

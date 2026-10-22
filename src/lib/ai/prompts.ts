/**
 * AI prompt templates for study material analysis and schedule generation.
 */

export const MATERIAL_ANALYSIS_PROMPT = `You are an expert educational content analyzer. Your job is to analyze uploaded study material and break it down into logical study topics/chapters.

STEP 1 — HOLISTIC ASSESSMENT & REALISTIC HOUR BUDGETING:
First, assess the TARGET EXAM as a whole, anchored in the STUDENT ACADEMIC PROFILE (their country, academic tier, and exact grade year).
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
1. Give it a clear, concise academic chapter/topic name (including book name & chapter number when available).
2. Rate its difficulty from 1-5 (1=easy, 5=very complex).
3. Rate expected student confidence from 1-5 (3=neutral).
4. Assign study hours from your global budget (the sum of all chapters MUST equal totalEstimatedHours).

HOUR ROUNDING RULE: All hour estimates (both per-chapter user_estimated_total_hours and totalEstimatedHours) MUST be cleanly rounded to 0.5 hour increments (e.g. 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0). NEVER output unrounded decimals like 6.1, 6.2, or 4.13.

CRITICAL RULE 0 — PTA (PROGRAMMA VAN TOETSING EN AFSLUITING) & SCHOOL SYLLABUS TABLES (ABSOLUTE TOP PRIORITY):
Secondary school students (in the Netherlands: VMBO, HAVO, VWO; or international curricula) frequently upload a PTA (Programma van Toetsing en Afsluiting) or school examination schedule table.
A PTA is an official multi-exam syllabus table covering all tests across the school year or multiple years, typically structured with columns such as:
- Period / Toetscode: Periode 1, Periode 2, Periode 3, Periode 4, SE1, SE2, SE3, TW1, TW2, Toetscode 411, 521, 631, etc.
- Inhoud / Stofomschrijving / Hoofdstukken: specific textbook chapters, modules, and paragraph numbers (e.g. "Pulsar 3e ed. H4 Arbeid en Energie (§4.1 t/m 4.5), H5 Cirkelbeweging (§5.1 t/m 5.4)", "Nova H3 Reacties van metalen, H4 Zouten", "Biologie voor Jou H4 Voeding en vertering, H5 Transport, H6 Gaswisseling", "Getal & Ruimte H9 Exponentiële functies").
- Duur, Weging, Toetsvorm, Herkansbaar.

1. SCOPE ISOLATION (MANDATORY WHEN USER GIVES INSTRUCTIONS):
   The student is studying for ONE specific upcoming exam from this PTA.
   - When the student provides instructions (e.g. "periode 2", "SE 2", "toetsweek 1", "hoofdstuk 4 en 5", "toets 3", "toetscode 621", "de komende toets"):
     * You MUST locate the exact row, cell, or entry in the PTA table corresponding to the student's request.
     * You MUST extract material EXCLUSIVELY from that specific matching exam row.
   - ABSOLUTE PROHIBITION ON BLEED-OVER:
     You are STRICTLY FORBIDDEN from including chapters, topics, or material from other periods or exams in the PTA! If the user requests "Periode 2", you must NEVER include chapters from Periode 1, Periode 3, or Periode 4.
   - If the student did NOT specify a period in their instructions, identify the upcoming exam based on the exam date or choose the first upcoming/current period exam row. NEVER dump the entire 3-year PTA syllabus into a single exam!

2. VERBATIM CHAPTER NUMBERS & TITLES FROM THE PTA ROW:
   The PTA row contains the authoritative chapters specified by the school.
   - You MUST extract the EXACT chapter numbers and chapter titles stated in that PTA row!
   - Required format: "H[Number]: [Title from PTA]. [Book Name]" or "H[Number]: [Title from PTA]".
     ALWAYS put the chapter number and topic title FIRST so it is immediately readable without being cut off!
     Examples of required outputs:
     * "H4: Arbeid en energie. Pulsar"
     * "H5: Cirkelbeweging. Pulsar"
     * "H3: Reacties van metalen. Nova"
     * "H4: Voeding en vertering. Biologie voor Jou"
     * "H1: Getallen en variabelen. Getal en Ruimte"
     * "H10: Differentiëren. Getal en Ruimte"
   - STRICT PROHIBITION: NEVER start the title with the textbook name (e.g. NEVER "Getal en Ruimte H1: ..."). ALWAYS put "H[Number]: [Title]" first!
   - When the PTA states specific chapter numbers (e.g. H4, H5), you MUST output exactly those chapters.
   - FOR EXAMS WITH 5 OR 6+ CHAPTERS: Follow Rule 3! In secondary school, each chapter has ~5 paragraphs (§1 t/m §5). 6 chapters = 30 paragraphs! The first 2 (or 3) foundational chapters are "voorkennis" (prior knowledge) — combine them into 1 review topic with less study time (e.g. "H1 & H2: Voorkennis & Basis (Herhaling). [Boek]"), while keeping the remaining 3–4 advanced chapters distinct!
   - FOR EXAMS WITH 2 TO 4 CHAPTERS: Keep each chapter distinct.

3. PARAGRAPHS & SPECIFIC SUB-SECTIONS:
   If the PTA lists specific paragraph ranges (e.g. "§4.1 t/m 4.5" or "par 3.1, 3.2, 3.4"), keep this information in the chapter summary or include the paragraph numbers in the chapter name so the student knows which sections are covered.

CRITICAL RULE 1 — PRACTICE QUESTIONS, EXAM PAPERS & EXERCISE SETS:
This rule applies ONLY when raw practice questions, exam problem sets (opgaven), or exercise sheets are uploaded without chapter outlines (e.g. past Centraal Examen / Schoolexamen opgaven).
Exam questions wrap problems in narrative scenarios (e.g. "Wijnfraude", "Nuclidetherapie", "Echografie", "Auto botsing").
When raw practice questions are uploaded:
1. NEVER create a chapter for each question/opgave.
2. NEVER use question story titles or case scenarios in chapter names (e.g. NEVER "Wijnfraude", "Nuclidetherapie").
3. Group questions into 2 to 4 core academic curriculum domains (e.g. "Kernfysica en Radioactiviteit", "Medische Beeldvorming").
NOTE: This abstraction rule strictly DOES NOT apply to PTAs or textbook syllabi! For PTAs, follow Rule 0 and extract the exact textbook chapters.

CRITICAL RULE 2 — TEXTBOOK METHODS, BOOK TITLES & CHAPTER NUMBERS:
Whenever the material, syllabus, PTA, or user instructions mention a specific textbook method, book title, or list of chapters/modules (e.g., "Methode: Polaris 1,3,7,8,13", "Pulsar H3, H4", "Nova H1 t/m H4", "Chemie Overal H7, H8", "Campbell Biology Ch 1–4", "Getal & Ruimte H2, H3"):
1. THE STUDENT HAS A PHYSICAL OR DIGITAL TEXTBOOK ON THEIR DESK! They must know EXACTLY which book and chapter to open when sitting down to study.
2. FORMAT CHAPTERS WITH CHAPTER TITLE FIRST:
   - Format: "H[Number]: [Chapter Topic Title]. [Book Name]" (or "Chapter [Number]: [Topic Title]. [Book Name]")
   - ALWAYS put the chapter number and title FIRST, followed by the textbook name.
   - Examples of required titles:
     * "H1: Beweging. Polaris"
     * "H3: Krachten en wetten van Newton. Polaris"
     * "H7: Kracht en evenwicht. Polaris"
     * "H8: Energie en arbeid. Polaris"
     * "H13: Cirkelbanen en gravitatie. Polaris"
     * "H5: Machtsverbanden. Getal en Ruimte"
     * "H10: Differentiëren. Getal en Ruimte"
3. STRICT PROHIBITION AGAINST COLLAPSING:
   Under NO circumstances should you collapse or erase specific textbook chapters into generic broad academic domains that hide the chapter numbers!
   Create the exact distinct chapters corresponding to the specified book chapters so the student can study chapter-by-chapter.
4. MAP SYLLABUS LEERDOELEN / OBJECTIVES TO CHAPTERS:
   When the syllabus provides learning goals (e.g. Leerdoelen 1–10, exam domains C1, C2, C3, F2) alongside the textbook chapters, map each learning goal to its corresponding textbook chapter.

CRITICAL RULE 3 — VOORKENNIS COMBINING FOR LARGE EXAMS (5+ OR 6 CHAPTERS):
In secondary school (HAVO / VWO / VMBO), each textbook chapter contains 4 to 5 paragraphs (§1 t/m §5).
An exam covering 5, 6, or more chapters represents 25 to 30 paragraphs!
In Dutch high school tests with 5 or 6 chapters, the earlier chapters (the first 1, 2, or 3 foundational/lower-numbered chapters) are "voorkennis" (prior knowledge / prerequisite review from earlier terms or school years).
Treating every single one of 6 chapters as heavy, equal-length new material causes severe desk paralysis.

MANDATORY RULES FOR 5+ OR 6 CHAPTER EXAMS:
1. COMBINE THE FIRST 2 (OR 3) FOUNDATIONAL CHAPTERS INTO 1 VOORKENNIS TOPIC:
   - Group the earliest foundational chapters (e.g. H1 & H2, or H1 & H3, or H1, H2 & H3) into ONE single chapter.
   - Title format: "H[X] & H[Y]: Voorkennis & Basis (Herhaling). [Book Name]"
     (e.g., "H1 & H3: Voorkennis & Basis (Herhaling). Polaris", "H1 & H2: Voorkennis (Herhaling). Getal en Ruimte", "Ch 1 & Ch 2: Foundations & Review. [Book]").
2. LESS IMPORTANCE & LIGHT STUDY HOURS FOR VOORKENNIS:
   - Assign a light study budget to this combined voorkennis chapter (typically 1.0 to 1.5 hours total, e.g. 1.0h).
   - Rate difficulty as 2 (light review) and confidence as 4.
   - Merge formulas from those earlier chapters into this chapter's formulas list.
3. REMAINING ADVANCED CHAPTERS REMAIN DISTINCT & GET THE MAJORITY OF HOURS:
   - The newer, heavily tested chapters (the remaining 3 to 4 chapters) must each stay distinct.
   - Allocate the main study budget (typically 1.5h to 2.5h each) and higher difficulty (3 to 5) to these core chapters.
4. SMALL EXAMS (2 TO 4 CHAPTERS):
   - Keep each chapter distinct. Only apply voorkennis combining when the exam has 5 or more chapters.

CRITICAL RULE 4 — EXACT TITLES ONLY FOR REAL TEXTBOOK TABLES OF CONTENTS:
The rule to copy exact titles word-for-word ONLY applies when the text contains an authentic textbook Table of Contents, syllabus outline, or book chapter list (e.g. "Hoofdstuk 4: Zuren en Basen", "Thema: Genetica").
It strictly DOES NOT apply to question/opgave titles or problem numbers in tests or practice sets.

CRITICAL RULE 5 — LANGUAGE WRITING & ESSAY EXAMS (SCHRIJFVAARDIGHEID, BETOOG, ESSAY, ARTIKEL, SPREEKVAARDIGHEID):
When the exam subject is a language (English, Dutch, German, French, Spanish) and the test is an essay, argumentative writing, or speaking exam (e.g. "Betoog", "Schrijfvaardigheid", "Essay", "Domein D", "Argumenterend schrijven", "Artikel", "Formal Letter", "Spreekvaardigheid", "Mondeling"):
1. RECOGNIZE THE ESSAY / WRITING NATURE:
   The student is writing a structured text or essay under exam conditions (e.g. 120 min). THIS IS NOT A VOCABULARY MEMORIZATION TEST AND NOT A GRAMMAR WORKSHEET!
2. STRICT PROHIBITION ON VOCABULARY & GENERIC GRAMMAR CHAPTERS:
   - When a school PTA mentions words like "woordenschat, grammatica" under Schrijfvaardigheid, these are merely GRADING CRITERIA (evaluating whether the essay uses formal academic vocabulary and correct sentence structures).
   - NEVER create a standalone chapter called "Woordenschat en grammatica", "Grammar and Vocabulary", or "Domein D: Schrijfvaardigheid"!
3. STRICT PROHIBITION ON RAW BUREAUCRATIC PTA JARGON:
   - NEVER copy bureaucratic administrative PTA phrases as chapter titles, such as:
     * "Toepassing van conventies formeel argumenterend betoog"
     * "Domein D. Schrijfvaardigheid"
     * "Standpunt innemen en onderbouwen"
   - These are vague and meaningless to a student sitting down to study.
4. MANDATORY ACTIONABLE ESSAY PREPARATION CHAPTERS (typically 3 to 4 topics):
   Break down the preparation into concrete, practical writing stages:
   - Topic 1: "Essaystructuur & Conventies (Inleiding, Thesis & Alinea-indeling)"
     (Focus: Planning the essay, writing an engaging hook, formulating a clear thesis statement, structuring body paragraphs with PEEL: Point, Evidence, Explanation, Link, and writing a strong conclusion).
   - Topic 2: "Formeel Register & Signaalwoorden (Linking Words)"
     (Focus: Mastering transitional phrases like furthermore, however, in spite of, consequently, on the one hand / on the other hand, avoiding informal contractions and colloquialisms).
   - Topic 3: "Argumentatiestructuur & Tegenargumenten (Onderbouwing & Weerlegging)"
     (Focus: Formulating strong main arguments with evidence, anticipating opposing viewpoints, and writing persuasive rebuttals).
   - Topic 4: "Oefenessay Schrijven & Beoordelingsrubric"
     (Focus: Writing a complete practice essay under timed conditions, self-checking against the assessment criteria: word count, layout, register, cohesion, and spelling).
5. DO NOT APPEND FAKE BOOK NAMES:
   If no textbook was provided, do NOT append ". Engels" or ". [Subject]" to the chapter titles!

General Guidelines:
- When specific textbook chapters are listed (e.g. 2 to 5 chapters), create exactly those chapters.
- You CAN assign fractional hours (e.g., 0.5, 1.0, 1.5, 2.0) for concise review or overview chapters.
- FORMULA EXTRACTION: If there are specific formulas, equations, or laws given in the text, you MUST extract them and include them in the "formulas" array for the relevant chapter so the student can study them.
- GROUPING SUBTOPICS: If the provided text contains high-level Themes/Chapters with many sub-bullet points underneath them, YOU MUST GROUP THEM into the main Theme. NEVER turn every single bullet point or subtopic into its own standalone chapter.
- IMPORTANT LANGUAGE RULE: You MUST output all chapter names and summaries in the EXACT SAME LANGUAGE as the provided study material. Keep Dutch textbook and PTA chapter names in Dutch! Do not translate Dutch material to English.

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
  userProfile?: any,
  userTextbook?: string
): string {
  // Truncate or window very long texts to fit comfortably in LLM context while preserving subject content
  const maxChars = 50000;
  let truncatedText = text;
  if (text.length > maxChars) {
    // Intelligent windowing: search for where subjectName or specialInstructions appear
    const searchTerms = [subjectName, specialInstructions].filter(Boolean).map(s => s!.toLowerCase());
    let bestPos = -1;
    for (const term of searchTerms) {
      const idx = text.toLowerCase().indexOf(term);
      if (idx !== -1) {
        bestPos = idx;
        break;
      }
    }

    if (bestPos !== -1) {
      const start = Math.max(0, bestPos - 15000);
      const end = Math.min(text.length, start + maxChars);
      truncatedText = (start > 0 ? '[... preceding document pages omitted ...]\n\n' : '') +
        text.substring(start, end) +
        (end < text.length ? '\n\n[... following document pages omitted ...]' : '');
    } else {
      truncatedText = text.substring(0, maxChars) + '\n\n[... document truncated for analysis ...]';
    }
  }

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
  const isPracticeExam = /(?:opgave|vraag)\s*\d+|centraal\s*examen|oefenexamen|oefentoets|examenopgave/i.test(text);
  const isPtaOrSyllabus = /(?:pta|programma\s*van\s*toetsing|toetscode|schoolexamen|periode\s*\d|se\s*\d|tw\s*\d|stofomschrijving|toetsstof)/i.test(`${text} ${specialInstructions || ''}`);

  let practiceExamNotice = '';
  if (isPracticeExam && !isPtaOrSyllabus) {
    practiceExamNotice = `
### DETECTED PRACTICE QUESTIONS / EXAM MATERIAL ###
Notice: The provided material contains practice questions, exam tasks (opgaven), or test exercises.
1. DO NOT create a chapter for each question! Group all questions into 2 to 4 core academic syllabus domains (e.g. "Kernfysica en Radioactiviteit", "Medische Beeldvorming").
2. FORBIDDEN CHAPTER NAMES: Do NOT use question story scenarios or application contexts in chapter names (e.g. NEVER "Wijnfraude", "Nuclidetherapie", "Echografie bij...", "Wijnfraude en ...", "Opgave 1"). Output 100% academic curriculum domain titles.
3. STUDY HOURS: Suggest a realistic, focused total of 5 to 8 hours for practicing/revising these exam questions. DO NOT suggest 20+ hours!
`;
  }

  const hasSpecialInstructions = Boolean(specialInstructions && specialInstructions.trim().length > 0);
  const hasUserTextbook = Boolean(userTextbook && userTextbook.trim().length > 0);

  const gradeStr = userProfile?.gradeLabel || userProfile?.grade || '';
  const trackStr = userProfile?.academicTierLabel || userProfile?.academicTier || '';
  const isUpperSecondary = /6|5|12|11|bovenbouw|senior|vwo|havo/i.test(gradeStr + ' ' + trackStr);

  return `${hasSpecialInstructions ? `================================================================================
### CRITICAL USER REQUEST & TARGET EXAM SCOPE (ABSOLUTE HIGHEST PRIORITY) ###
The student specified the following instruction for this exam:
"${specialInstructions!.trim()}"

MANDATORY DIRECTIVES FOR THIS INSTRUCTION:
1. SCOPE ISOLATION: This instruction defines the EXACT exam or test from the PTA/syllabus the student is preparing for.
2. PTA / SYLLABUS TABLE ROW MATCHING:
   - If the study material is a PTA (Programma van Toetsing en Afsluiting) or school syllabus table with multiple periods/exams:
     * MATCHING KEYWORDS: Match ANY of:
       - Grade / Year: e.g. "6-VWO", "VWO6", "VWO 6", "5-VWO", "4-VWO", "HAVO 5", etc.
       - Month or Period: e.g. "November", "Maart", "Juni", "September", "Periode 1", "Periode 2", "TW 1", "Toetsweek"
       - Exam code or title: e.g. "WIA6VT5", "Tentamen II", "Tentamen I", "SE 2", "SE November"
       - Type of test: e.g. "Schoolexamen", "SE", "Voortgangstoets"
     * If the document covers multiple school years (e.g. 4-VWO, 5-VWO, 6-VWO), find the row matching the student's exact requested year and moment (for example: "6-VWO November" = Tentamen II, toetscode WIA6VT5_26)!
     * Extract material EXCLUSIVELY from that specific matching exam row's "Leerstof / Stof / Inhoud / Hoofdstukken" section.
     * STRICTLY FORBIDDEN: Do NOT include chapters, topics, or material from ANY other period, year, or exam in the PTA!
     * EXACT CHAPTER TITLES: When the row specifies specific chapters (e.g. "H 1, 3, 5, 8, 10, 12" or "H4 en H5"), format with the chapter first: "H[Number]: [Title]. [Book Name]" or "H[Number]: [Title]".
     * FOR EXAMS WITH 5 OR 6+ CHAPTERS: Follow Rule 3! Assume the first 2 (or 3) foundational chapters are voorkennis (prior knowledge) and combine them into 1 review chapter with lighter study hours (e.g. "H1 & H2: Voorkennis & Basis (Herhaling). [Boek]"), while keeping the remaining 3–4 advanced chapters distinct!
     * FOR EXAMS WITH 2 TO 4 CHAPTERS: Keep each chapter distinct.
================================================================================\n` : (isPtaOrSyllabus ? `================================================================================
### DETECTED PTA (PROGRAMMA VAN TOETSING EN AFSLUITING) / SCHOOL SYLLABUS TABLE ###
The uploaded material contains a PTA table with multiple exams across periods.
- Since the student did not specify an exact period, identify the single upcoming exam/period relevant to the exam date (${examDate}) or current school term.
- Focus ONLY on that single exam's row and extract its exact chapter numbers and titles.
- Do NOT include chapters from other periods or the entire multi-year syllabus!
================================================================================\n` : '')}
${hasUserTextbook ? `================================================================================
### STUDENT'S TEXTBOOK FOR ${subjectName.toUpperCase()} ###
The student is studying with this textbook: "${userTextbook!.trim()}"
- When the uploaded PTA or syllabus lists general topics or domains (e.g. "Arbeid & Energie", "Medische Beeldvorming", "Zuren en Basen") without explicitly naming a book or chapter numbers:
  * You MUST map these tested syllabus topics/domains to the corresponding chapters in the student's textbook: "${userTextbook!.trim()}".
  * Format each chapter as: "H[Number]: [Chapter Title]. ${userTextbook!.trim()}". Always put the chapter number and title first!
  * This guarantees the student knows exactly which chapter of the physical/digital book on their desk to open!
- If the uploaded PTA does explicitly state different chapter numbers or a different book for this specific exam, follow the PTA's explicit row.
================================================================================\n` : ''}
Analyze the study material for the subject "${subjectName}" (exam date: ${examDate}).

First estimate the TOTAL realistic study hours for the target exam (typically 5 to 9 hours for secondary students; NEVER 20+ hours), then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
${timeConstraintStr}
${practiceExamNotice}

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
- DO NOT suggest 20-30 hours! Keep the total study hours motivating, manageable, and realistically achievable.` : 
`Calibrate pacing and hour allocations realistically for ${userProfile.academicTierLabel || ''} ${userProfile.gradeLabel || ''}. Target a realistic total of 4 to 7 hours for the exam.`}
` : ''}

--- STUDY MATERIAL ---
${truncatedText}
--- END MATERIAL ---

${hasSpecialInstructions ? `REMINDER: The student specifically requested: "${specialInstructions!.trim()}". You MUST ensure your JSON chapters match the exact chapters specified for this test in the material. Do NOT include chapters from other periods or invent generic topics!` : ''}`;
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

export { stripPromptArtifacts } from './textSanitizer';



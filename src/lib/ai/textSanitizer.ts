/**
 * Strips AI prompt wrappers, system section delimiters, database textbook indexes,
 * and internal AI directives from syllabus text.
 * Leaves only authentic student syllabus / notes.
 */
export function stripPromptArtifacts(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  let cleaned = input;

  for (let iteration = 0; iteration < 5; iteration++) {
    const prev = cleaned;

    // 1. Strip target section wrappers
    cleaned = cleaned.replace(/=== TARGET SUBJECT & EXAM SECTION LOCATED IN DOCUMENT FOR [^\n=]+ ===\s*/gi, '');
    cleaned = cleaned.replace(/=== END TARGET SECTION ===\s*/gi, '');

    // 2. Strip student PTA wrappers
    cleaned = cleaned.replace(/--- STUDENT'S OFFICIAL PTA \/ SCHOOL EXAM SYLLABUS \(PRIMARY SOURCE OF TRUTH\) ---\s*/gi, '');
    cleaned = cleaned.replace(/--- END STUDENT PTA ---\s*/gi, '');

    // 3. Strip trailing / injected textbook indexes and directives
    cleaned = cleaned.replace(/\n\s*Authentic Textbook Contents Found in Database[\s\S]*$/gi, '');
    cleaned = cleaned.replace(/\n\s*REFERENCE TEXTBOOK INDEX FOR[\s\S]*$/gi, '');
    cleaned = cleaned.replace(/\n\s*CRITICAL INSTRUCTION:[\s\S]*$/gi, '');
    cleaned = cleaned.replace(/\n\s*CRITICAL PTA DIRECTIVES:[\s\S]*$/gi, '');
    cleaned = cleaned.replace(/\n\s*PROGRESSIVE WEIGHTING FOR EXAMS WITH MANY CHAPTERS[\s\S]*$/gi, '');

    // Also match if textbook contents or directives appear in the middle (if re-wrapped)
    cleaned = cleaned.replace(/Authentic Textbook Contents Found in Database for "[^"]+":[\s\S]*?(?=(?:Subject:|Jaarlaag|Leerdoelen|Leerstof|===|---|$))/gi, '');
    cleaned = cleaned.replace(/REFERENCE TEXTBOOK INDEX FOR "[^"]+"[\s\S]*?(?=(?:Subject:|Jaarlaag|Leerdoelen|Leerstof|===|---|$))/gi, '');
    cleaned = cleaned.replace(/CRITICAL INSTRUCTION:[\s\S]*?(?=(?:Subject:|Jaarlaag|Leerdoelen|Leerstof|===|---|$))/gi, '');
    cleaned = cleaned.replace(/CRITICAL PTA DIRECTIVES:[\s\S]*?(?=(?:Subject:|Jaarlaag|Leerdoelen|Leerstof|===|---|$))/gi, '');
    cleaned = cleaned.replace(/PROGRESSIVE WEIGHTING FOR EXAMS WITH MANY CHAPTERS[\s\S]*?(?=(?:Subject:|Jaarlaag|Leerdoelen|Leerstof|===|---|$))/gi, '');

    // 4. Strip prepended Subject / Material headers
    cleaned = cleaned.replace(/^(?:\s*Subject:\s*[^\n]*\n)+(?:\s*Material\s*\/\s*Syllabus\s*Provided\s*by\s*Student:\s*\n)*/gim, '');
    cleaned = cleaned.replace(/^\s*Material\s*\/\s*Syllabus\s*Provided\s*by\s*Student:\s*\n/gim, '');

    if (cleaned === prev) break;
  }

  return cleaned.trim();
}

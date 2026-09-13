import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { z } from 'zod';

export interface SessionDetailInput {
  index: number;
  subject: string;
  chapter: string;         // The raw chapter name (may be combined, e.g. "Chapter 4 & Chapter 5")
  difficulty: number;      // 1–5
  formulas?: string[];     // Any formulas extracted from the study material
  numMerged: number;       // How many original sessions this represents
  durationMinutes: number; // The total duration of this session in minutes
}

export interface SessionDetailOutput {
  index: number;
  shortTitle: string;      // Short display name for calendar/list
  fullTitle: string;       // Full descriptive action-oriented title for session detail header
  tasks: string[];         // 2–4 specific study tasks for this session
}

const SessionDetailSchema = z.object({
  sessions: z.array(z.object({
    index: z.number(),
    shortTitle: z.string(),
    fullTitle: z.string(),
    tasks: z.array(z.string()).min(1).max(10),
  })),
});

const SYSTEM_PROMPT = `You are an expert, subject-aware study coach. Given a list of study sessions with their subject, chapter topic, difficulty, formulas, numMerged, and durationMinutes, your job is to generate smart, subject-tailored tasks.

CRITICAL REALISTIC TIME & TASK PACING RULE:
A study session's duration varies. The input includes 'durationMinutes' and 'numMerged'.
If 'numMerged' > 1, this session is a COMPRESSED session of multiple original sessions. YOU MUST GENERATE EXACTLY 'numMerged' TASKS. 
For example, if numMerged = 3 and duration = 60 mins, generate exactly 3 tasks, where each task is doable in 20 minutes. Ensure the tasks collectively cover the combined 'chapter' topics evenly.

If 'numMerged' == 1:
Do NOT overcrowd a session with 4 different heavy tasks!
- HEAVY / DEEP-FOCUS TASKS (e.g., Mathematics problem sets, Physics derivations, Essay outlines, Coding exercises):
  Generate 1 SINGLE comprehensive task (or 2 focused sub-tasks at most) that fills the entire session properly. It is COMPLETELY FINE and encouraged for a session to have just 1 solid task (e.g. "Solve practice problem set on [Topic] and verify step-by-step calculations").
- LIGHT / RECALL TASKS (e.g., Foreign language vocabulary + grammar table review):
  Generate 2 concise tasks.

CRITICAL SUBJECT-AWARE STUDY TASK MATRIX:
Determine the academic field of the subject and generate tasks matching these subject-specific methodologies, PROVEN to be the best way to prepare for exams in those fields:

1. MATHEMATICS, PHYSICS, CALCULUS, ALGEBRA, STATISTICS:
   - NEVER suggest flashcards, summaries, or timelines. Math & Physics are learned by DOING problems.
   - Task style: "Solve 3–5 comprehensive practice problems on [Chapter/Topic] and verify calculations"

2. CHEMISTRY, BIOLOGY, ANATOMY, ENVIRONMENTAL SCIENCE:
   - Task style: "Draw the biological/chemical process flowchart for [Topic] from memory" or "Active recall test on key terms"

3. FOREIGN LANGUAGES (German, French, Spanish, English, Dutch, Latin, etc.):
   - Task style: "Practice verb conjugation tables and grammar rules for [Topic]" or "Translate a practice passage"

4. HISTORY, GEOGRAPHY, ECONOMICS, BUSINESS, LAW, PSYCHOLOGY, PHILOSOPHY:
   - Task style: "Draft a structured bullet-point essay outline addressing a past exam prompt on [Topic]" or "Analyze key economic/legal theories"

5. COMPUTER SCIENCE & INFORMATICS:
   - Task style: "Write and debug code / pseudo-code for [Algorithm/Topic] from scratch"

TASK GENERATION RULES:
- Output tasks in the EXACT SAME LANGUAGE as the chapter title (e.g., if Dutch, output Dutch; if German, German).
- If formulas are provided, include a task specifically practicing/applying those formulas.
- shortTitle: MUST be verbatim the chapter name (short, concise for calendar chips).
- fullTitle: Actionable 1-sentence title formatted as "[Chapter]: [Action]".`;

/**
 * Generates descriptive titles and task checklists for a batch of study sessions.
 * All sessions are sent in one API call for efficiency.
 */
export async function generateSessionDetails(
  sessions: SessionDetailInput[],
  userProfile?: any
): Promise<SessionDetailOutput[]> {
  if (sessions.length === 0) return [];

  const gradeStr = userProfile?.gradeLabel || userProfile?.grade || 'Klas 6';
  const trackStr = userProfile?.academicTierLabel || userProfile?.academicTier || 'VWO';
  const country = userProfile?.countryName || 'Netherlands';

  const profileInstruction = `
\nSTUDENT ACADEMIC LEVEL & CONTEXT:
- Track: ${trackStr}
- Grade / Year: ${gradeStr}
- Country: ${country}
CALIBRATION DIRECTIVE:
Calibrate the task style and cognitive depth to this grade. For upper-secondary / final exam years (e.g. VWO 6, HAVO 5, examenjaar), tasks should focus on authentic exam-level problem solving (CE/SE practice), applying reference data (like BINAS tables for Dutch science subjects), and synthesising complex concepts, rather than elementary flashcards.`;

  const systemPrompt = SYSTEM_PROMPT + profileInstruction;

  const userMessage = JSON.stringify(sessions.map(s => ({
    index: s.index,
    subject: s.subject,
    chapter: s.chapter,
    difficulty: s.difficulty,
    formulas: s.formulas || [],
    numMerged: s.numMerged,
    durationMinutes: s.durationMinutes,
  })));

  try {
    const result = await generateStructuredOutput(
      systemPrompt,
      userMessage,
      SessionDetailSchema,
      'sessions'
    );
    return result.sessions;
  } catch (err) {
    console.error('[generateSessionDetails] AI call failed, skipping enrichment:', err);
    // Graceful fallback: return empty so sessions are still saved without enrichment
    return [];
  }
}

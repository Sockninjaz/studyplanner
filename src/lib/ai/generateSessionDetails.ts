import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { z } from 'zod';

export interface SessionDetailInput {
  index: number;
  subject: string;
  chapter: string;         // The raw chapter name (may be combined, e.g. "Chapter 4 & Chapter 5")
  difficulty: number;      // 1–5
  formulas?: string[];     // Any formulas extracted from the study material
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
    tasks: z.array(z.string()).min(1).max(3),
  })),
});

const SYSTEM_PROMPT = `You are an expert, subject-aware study coach. Given a list of study sessions with their subject, chapter topic, difficulty, and formulas, your job is to generate smart, subject-tailored tasks.

CRITICAL REALISTIC TIME & TASK PACING RULE:
A study session's duration varies based on the chapter's estimated hours. Do NOT overcrowd a session with 4 different heavy tasks!
- HEAVY / DEEP-FOCUS TASKS (e.g., Mathematics problem sets, Physics derivations, Essay outlines, Coding exercises):
  Generate 1 SINGLE comprehensive task (or 2 focused sub-tasks at most) that fills the entire session properly. It is COMPLETELY FINE and encouraged for a session to have just 1 solid task (e.g. "Solve practice problem set on [Topic] and verify step-by-step calculations").
- LIGHT / RECALL TASKS (e.g., Foreign language vocabulary + grammar table review):
  Generate 2 concise tasks.

CRITICAL SUBJECT-AWARE STUDY TASK MATRIX:
Determine the academic field of the subject and generate 1-3 tasks matching these subject-specific methodologies:

1. MATHEMATICS, PHYSICS, CALCULUS, ALGEBRA, STATISTICS:
   - NEVER suggest flashcards, summaries, or timelines. Math & Physics are learned by DOING problems.
   - Heavy Task (can be the ONLY task for the session):
     * "Solve 3–5 comprehensive practice problems on [Chapter/Topic] and verify step-by-step calculations"
     * "Work through solved textbook examples for [Topic] and re-solve without looking at solutions"
     * "Derive and apply formula [Formulas] step-by-step on 3 example questions"

2. CHEMISTRY, BIOLOGY, ANATOMY, ENVIRONMENTAL SCIENCE:
   - Tasks MUST focus on:
     * "Draw the biological/chemical process flowchart for [Topic] from memory and check against textbook"
     * "Active recall test on key terms and structures for [Topic]"
     * "Explain the mechanism of [Concept] out loud without notes"

3. FOREIGN LANGUAGES (German, French, Spanish, English, Dutch, Latin, etc.):
   - Tasks MUST focus on:
     * "Practice verb conjugation tables and grammar rules for [Topic]"
     * "Memorise and active-recall 15–20 vocabulary words for [Topic]"
     * "Translate a practice passage applying [Grammar rule]"

4. HISTORY, GEOGRAPHY, ECONOMICS, BUSINESS, LAW, PSYCHOLOGY, PHILOSOPHY:
   - Heavy Task (can be 1-2 tasks):
     * "Draft a structured bullet-point essay outline addressing a past exam prompt on [Topic]"
     * "Construct a cause-and-effect timeline / concept map for [Era/Topic]"
     * "Analyze and contrast key economic/legal theories for [Topic]"

5. COMPUTER SCIENCE & INFORMATICS:
   - Heavy Task (can be 1 task):
     * "Write and debug code / pseudo-code for [Algorithm/Topic] from scratch"
     * "Dry-run and trace variables step-by-step for [Topic] logic"

TASK GENERATION RULES:
- Output 1–3 realistic tasks per session (prefer 1–2 deep tasks over 3–4 rushed ones).
- Output tasks in the EXACT SAME LANGUAGE as the chapter title (e.g., if Dutch, output Dutch; if German, German; if English, English).
- If formulas are provided in the input, include a task specifically practicing/applying those formulas.
- shortTitle: MUST be verbatim the chapter name (short, concise for calendar chips).
- fullTitle: Actionable 1-sentence title formatted as "[Chapter]: [Action]".`;

/**
 * Generates descriptive titles and task checklists for a batch of study sessions.
 * All sessions are sent in one API call for efficiency.
 */
export async function generateSessionDetails(
  sessions: SessionDetailInput[]
): Promise<SessionDetailOutput[]> {
  if (sessions.length === 0) return [];

  const userMessage = JSON.stringify(sessions.map(s => ({
    index: s.index,
    subject: s.subject,
    chapter: s.chapter,
    difficulty: s.difficulty,
    formulas: s.formulas || [],
  })));

  try {
    const result = await generateStructuredOutput(
      SYSTEM_PROMPT,
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

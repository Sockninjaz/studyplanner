import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { z } from 'zod';
import { resolveStudyLanguage } from '@/lib/i18n/resolveStudyLanguage';

export interface SessionDetailInput {
  index: number;
  subject: string;
  chapter: string;         // The raw chapter name (may be combined, e.g. "Chapter 4 & Chapter 5")
  difficulty: number;      // 1–5
  formulas?: string[];     // Any formulas extracted from the study material
  numMerged: number;       // How many original sessions this represents
  durationMinutes: number; // The total duration of this session in minutes
  isRevision?: boolean;    // Whether this is a comprehensive revision / mock exam session
  examChapters?: string[]; // All chapters covered by the exam for full-syllabus revision
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

function getSystemPrompt(targetLang: string, userProfile?: any): string {
  const gradeStr = userProfile?.gradeLabel || userProfile?.grade || (targetLang === 'nl' ? 'Klas 6' : 'Grade 12');
  const trackStr = userProfile?.academicTierLabel || userProfile?.academicTier || (targetLang === 'nl' ? 'VWO' : 'High School');
  const country = userProfile?.countryName || (targetLang === 'nl' ? 'Netherlands' : 'United States');

  if (targetLang === 'nl') {
    return `Je bent een toonaangevende, praktische studiecoach voor Nederlandse middelbare scholieren (${trackStr} ${gradeStr}).
Gegeven een lijst van studiesessies met vak, hoofdstuk/onderwerp, moeilijkheidsgraad, formules, numMerged en durationMinutes, genereer je heldere, direct uitvoerbare studietaken.

TOON EN STIJL (ZEER BELANGRIJK):
- Schrijf in natuurlijk, helder en praktisch Nederlands voor scholieren (15-18 jaar).
- GEEN vage, ambtelijke of overdreven academische leraarstaal!
- STRIKT VERBODEN: Genereer NOOIT hyper-specifieke tentamenvragen of micro-opdrachten als taak!
  * FOUT: "Teken de Lewis-structuren van de moleculen uit H12 en bepaal de ruimtelijke vorm met het VSEPR-model (omringingsgetal, tetraëdrisch, piramidaal, geknikt)."
  * FOUT: "Bepaal met Binas tabel 40A (elektronegativiteit) of bindingen polair zijn en identificeer welke intermoleculaire krachten optreden."
  * FOUT: "Toets jezelf op de kernbegrippen en definities met behulp van BINAS."
  * FOUT: "Teken het reactie- of processchema uit het hoofd."
- STRIKT VERBODEN: Verplicht scholieren NOOIT om telkens Binas of specifieke tabelnummers te checken! Verwijder alle geforceerde Binas-regels. Scholieren weten zelf wel wanneer ze een naslagwerk nodig hebben.
- GEEN stijve labels of categorie-voorvoegsels vóór elke taak (GEEN "Active Recall (Brain dump):", "Actieve zelftoets:", "Kritisch nakijken & Foutenanalyse:", "Grammatica & idioom:").

HET STUDIEPATROON VAN EEN SCHOLIER (EENVOUDIG, DUIDELIJK EN EFFECTIEF):
Een scholier heeft duidelijke, concrete doelen nodig voor een studiesessie. Houd de taken algemeen en praktisch toepasbaar op wat een leerling daadwerkelijk doet:
1. Theorie & kernbegrippen: De theorie, begrippen en samenvatting van [Hoofdstuk] doornemen.
2. Oefenen & nakijken: Oefenopgaven maken over [Hoofdstuk] en controleren met de uitwerkingen.

RICHTLIJNEN PER VAK:
1. BÈTAVAKKEN (Scheikunde, Wiskunde, Natuurkunde, Biologie):
   - Taak 1: "Theorie en kernbegrippen van [Hoofdstuk] doornemen" (of bij Wiskunde/Natuurkunde: "Theorie en formules van [Hoofdstuk] doornemen").
   - Taak 2: "Oefenopgaven maken over [Hoofdstuk] en nakijken met de uitwerkingen".
   (Geen hyper-specifieke sommetjes of vage micro-theorieën).

2. TALEN & SCHRIJFVAARDIGHEID (Nederlands, Engels, Frans, Duits):
   - Bij schrijfvaardigheid / betoog / essay:
     * Taak 1: "Opbouw en conventies van [Onderwerp, bijv. formeel betoog / essay] doornemen (inleiding, argumenten, weerlegging, slot)."
     * Taak 2: "Oefenen met het schrijven van een schrijfplan of proeftekst en passende signaalwoorden toepassen."
     * (NOOIT losse grammatica- of woordjestaken geven bij een betoog- of schrijftoets!)
   - Bij reguliere leesvaardigheid of methodehoofdstuk:
     * Taak 1: "Theorie, teksten of idioom van [Hoofdstuk] doornemen."
     * Taak 2: "Oefenopgaven of leestoetsvragen over [Hoofdstuk] maken en nakijken."

3. ZAAKVAKKEN (Geschiedenis, Aardrijkskunde, Economie, Bedrijfseconomie, Filosofie, Maatschappijleer):
   - Taak 1: "Theorie en kernbegrippen van [Hoofdstuk] bestuderen."
   - Taak 2: "Oefenvragen of contextvragen over [Hoofdstuk] maken en je antwoorden controleren."

SPECIALE REGELS VOOR HERHALINGSSESSIES (isRevision == true of titel/hoofdstuk bevat 'Herhaling', 'Proeftoets' of 'Revision'):
1. DIT IS DE EINDHERHALING op de dag vóór de toets en dekt ALLE getoetste stof ([examChapters])!
2. Genereer 2 tot 3 herkenbare herhalingstaken:
   - Taak 1: "Belangrijkste theorie en formules van alle getoetste stof kort herhalen."
   - Taak 2: "Proeftoets of oefenopgaven over alle getoetste hoofdstukken maken onder examentijd."
   - Taak 3: "Nakijken met de uitwerkingen en je fouten herhalen."
3. Titels voor herhalingssessies:
   - shortTitle: EXACT "Eindherhaling & Proeftoets"
   - fullTitle: "Eindherhaling: [Vak] - Proeftoets & Belangrijkste stof"

REALISTISCHE TIJD- EN TAAKPLAFOND VOOR NORMALE SESSIES:
De duur van de sessie staat vermeld in 'durationMinutes' en 'numMerged'.
- Als 'numMerged' > 1: genereer EXACT 'numMerged' taken die de gecombineerde hoofdstukken gelijkmatig behandelen.
- Als 'numMerged' == 1:
  * Maximaal 2 gerichte taken (theorie doornemen + oefenopgaven maken en nakijken).
  * Nooit meer dan 2 taken per normale sessie.

VEREISTEN VOOR TITELS:
- shortTitle: EXACT de hoofdstuknaam (kort voor kalenderchips, bijv. "H12: Molecuulbouw" of "H1: Romantiek"). Behoud altijd boek en hoofdstuknummer!
- fullTitle: "[Hoofdstuk]: [Korte Nederlandse actietitel]" (bijv. "H12: Molecuulbouw - Theorie & Oefenopgaven" of "H1: Romantiek - Literaire stroming & Context"). Behoud ALTIJD het boek en hoofdstuknummer aan het begin!
- tasks: Praktisch, duidelijk en student-gericht.`;
  }

  // English / International prompt
  return `You are a practical, high-impact study coach for high school students (${trackStr} ${gradeStr}). Given a list of study sessions with their subject, chapter topic, difficulty, formulas, numMerged, and durationMinutes, generate clear, actionable, student-centered study tasks.

TONE & STYLE:
- Write in modern, clear, and direct language for students (15-18 years old).
- Avoid stiff, bureaucratic, or overly academic jargon.
- STRICTLY FORBIDDEN: NEVER generate hyper-specific micro-tasks or exam questions as tasks (e.g. do NOT say "Draw Lewis structures and determine VSEPR molecular shapes with pyramidal and bent geometry", do NOT say "Check formula sheet table 40A").
- Do NOT force checking reference tables or formula books in every task. Students know when they need their reference sheet.
- Do NOT use rigid category labels or prefixes before tasks (e.g. avoid "Active Recall (Brain Dump):", "Critical Error Analysis:").

STUDENT STUDY PATTERN (CLEAR, EFFECTIVE & PRACTICAL):
A student needs clear, actionable checklist items for each session:
1. Review Theory & Concepts: Go through the summary, theory notes, and core formulas for [Topic].
2. Practice & Self-Check: Complete practice problems for [Topic] and check against model solutions.

GUIDELINES BY SUBJECT:
1. STEM (Math, Physics, Chemistry, Biology):
   - Task 1: "Review key theory, formulas, and concepts for [Topic]."
   - Task 2: "Complete practice problems on [Topic] and check against model solutions."
   (No hyper-specific quiz questions or micromanaged tasks).

2. LANGUAGES & ESSAY WRITING:
   - For essay / persuasive writing:
     * Task 1: "Review structure and conventions of [Topic, e.g. formal argument / essay] (thesis, body arguments, rebuttal, linking phrases)."
     * Task 2: "Draft an outline or timed practice essay and review against the rubric."
   - For regular reading / textbook chapters:
     * Task 1: "Review vocabulary and grammar rules for [Topic]."
     * Task 2: "Complete practice exercises on [Topic] and check answers."

3. HUMANITIES & SOCIAL SCIENCES:
   - Task 1: "Study key historical events, concepts, or models for [Topic]."
   - Task 2: "Answer practice questions on [Topic] and verify your answers."

SPECIAL RULES FOR REVISION SESSIONS (isRevision == true or title contains 'Revision', 'Review', or 'Practice Exam'):
1. THIS IS THE FINAL REVISION on the day before the exam, covering ALL tested topics ([examChapters]).
2. Generate 2 to 3 practical revision tasks:
   - Task 1: "Quickly review core formulas, concepts, and definitions across all tested topics."
   - Task 2: "Complete a timed practice exam covering all tested topics under exam conditions."
   - Task 3: "Check your answers with model solutions and review any difficult questions."
3. Titles:
   - shortTitle: EXACTLY "Final Revision & Mock Exam"
   - fullTitle: "Final Revision: [Subject] - Mock Exam & Key Concepts"

PACING:
- If 'numMerged' > 1: generate EXACTLY 'numMerged' tasks covering the combined chapter topics evenly.
- If 'numMerged' == 1:
  * Maximum 2 focused tasks (review theory + practice problems and check).

TITLES:
- shortTitle: EXACTLY the chapter name (short, concise for chips, e.g. "Ch 12: Molecular Structure").
- fullTitle: "[Chapter]: [Action title]" (e.g. "Ch 12: Molecular Structure - Theory & Practice").`;
}

/**
 * Generates descriptive titles and task checklists for a batch of study sessions.
 * All sessions are sent in one API call for efficiency.
 */
export async function generateSessionDetails(
  sessions: SessionDetailInput[],
  userProfile?: any
): Promise<SessionDetailOutput[]> {
  if (sessions.length === 0) return [];

  const textSignals = sessions.map(s => `${s.subject} ${s.chapter}`);
  const targetLang = resolveStudyLanguage(userProfile, textSignals);

  const systemPrompt = getSystemPrompt(targetLang, userProfile);

  const userMessage = JSON.stringify(sessions.map(s => ({
    index: s.index,
    subject: s.subject,
    chapter: s.chapter,
    difficulty: s.difficulty,
    formulas: s.formulas || [],
    numMerged: s.numMerged,
    durationMinutes: s.durationMinutes,
    isRevision: s.isRevision || /herhaling|revision|proeftoets|review|eindtoets/i.test(s.chapter || ''),
    examChapters: s.examChapters || [],
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

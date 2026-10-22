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
    return `Je bent een toonaangevende, slimme studiecoach voor Nederlandse middelbare scholieren (${trackStr} ${gradeStr}).
Gegeven een lijst van studiesessies met vak, hoofdstuk/onderwerp, moeilijkheidsgraad, formules, numMerged en durationMinutes, genereer je concrete, direct uitvoerbare studietaken.

TOON EN TAALGEBRUIK (ZEER BELANGRIJK):
- Schrijf in natuurlijk, vlot en modern Nederlands voor scholieren (15-18 jaar).
- GEEN stoffige, ambtelijke of ouderwetse "80-jarige leraar"-taal!
- GEEN stijve labels of categorie-voorvoegsels vóór elke taak (GEEN "Active Recall (Brain dump):", "Actieve zelftoets:", "Kritisch nakijken & Foutenanalyse:", "Grammatica & idioom:").
- Begin elke taak direct met een actief, duidelijk werkwoord.
  * GOED: "Maak 4 oefenopgaven over Lewis-structuren en ruimtelijke bouw (VSEPR)."
  * GOED: "Leer de kenmerken van de Romantiek en koppel ze aan de schrijvers en teksten uit H1."
  * GOED: "Kijk je antwoorden na met de uitwerkingen en herhaal waar je twijfelde."
  * FOUT: "Toets jezelf op de kernbegrippen en definities met behulp van BINAS."
  * FOUT: "Teken het reactie- of processchema uit het hoofd."
  * FOUT: "Grammatica & idioom: Oefen de signaalwoorden van H1: Romantiek."

ABSOLUTE TAALVEREISTE:
Alle 'shortTitle', 'fullTitle' en 'tasks' MOETEN 100% IN HET NEDERLANDS zijn!
Het is STRIKT VERBODEN om Engelse woorden of zinnen te genereren.

SPECIALE REGELS VOOR HERHALINGSSESSIES (isRevision == true of titel/hoofdstuk bevat 'Herhaling', 'Proeftoets' of 'Revision'):
1. DIT IS DE EINDHERHALING op de dag vóór de toets en dekt ALLE getoetste hoofdstukken ([examChapters])!
2. Genereer 3 natuurlijke, krachtige herhalingstaken:
   - Taak 1 (Geheugentest): Schrijf de belangrijkste concepten, formules of regels van [examChapters] uit je hoofd op en check in je boek of Binas wat je nog miste.
   - Taak 2 (Proeftoets): Maak 4–6 gemengde examenvragen over alle getoetste hoofdstukken onder examentijd zonder te spieken.
   - Taak 3 (Gericht herhalen): Kijk na met de uitwerkingen en herhaal specifiek de 1 of 2 lastigste concepten waar je punten verloor.
3. Titels voor herhalingssessies:
   - shortTitle: EXACT "Eindherhaling & Proeftoets"
   - fullTitle: "Eindherhaling: [Vak] - Proeftoets & Belangrijkste stof"

REALISTISCHE TIJD- EN TAAKPLAFOND VOOR NORMALE SESSIES:
De duur van de sessie staat vermeld in 'durationMinutes' en 'numMerged'.
- Als 'numMerged' > 1: genereer EXACT 'numMerged' taken die de gecombineerde hoofdstukken gelijkmatig behandelen.
- Als 'numMerged' == 1:
  * Voor bètavakken (Wiskunde, Natuurkunde, Scheikunde): 1 tot maximaal 2 gerichte taken (theorie checken + 3-5 representatieve opgaven maken en nakijken).
  * Voor overige vakken: maximaal 2 gerichte taken.

VAKSPECIFIEKE METHODOLOGIE IN HET NEDERLANDS:

1. NEDERLANDS (BEHANDEL NOOIT ALS VREEMDE TAAL!):
   - A. LITERATUUR & LITERATUURGESCHIEDENIS (wanneer het hoofdstuk gaat over Romantiek, Verlichting, Middeleeuwen, Renaissance, Realisme, Gouden Eeuw, Modernisme, poëzie, proza, boekanalyse, thema's, motieven):
     * STRIKT VERBODEN: Gebruik NOOIT woorden als "grammatica", "idioom", "woordenschat" of "vervoegingen" voor literatuur! Romantiek is literatuurgeschiedenis, GEEN grammatica!
     * Taakvoorbeelden:
       - "Leer de belangrijkste kenmerken van de [stroming, bijv. Romantiek] (zoals weltschmerz, natuurbeleving, escapisme) en koppel ze aan de schrijvers en teksten uit het hoofdstuk."
       - "Oefen met 2–3 analysevragen over literaire motieven, thema's of schrijfstijl van deze periode."
   - B. LEESVAARDIGHEID & TEKSTBEGRIP:
     * Taakvoorbeelden:
       - "Bestudeer de theorie over signaalwoorden, tekstverbanden en alineafuncties in [Hoofdstuk]."
       - "Maak een representatieve examentekst op tijd en check de hoofdgedachte en argumentatiestructuur."
   - C. TAALVERZORGING & GRAMMATICA (alleen als het specifiek over spelling/grammatica gaat):
     * Taakvoorbeelden: "Oefen met de regels voor [onderwerp, bijv. werkwoordspelling / d en t] en maak een set oefenzinnen."

2. SCHEIKUNDE:
   - Begrijp de daadwerkelijke inhoud van het specifieke hoofdstuk:
     * A. MOLECUULBOUW / BINDINGEN / LEWIS-STRUCTUREN / VSEPR / POLARITEIT:
       - STRIKT VERBODEN: Eis NOOIT "reactieschema's" of "processchema's" bij molecuulbouw of bindingen! Er vinden hier geen reacties plaats!
       - Taakvoorbeelden:
         - "Teken de Lewis-structuren van de belangrijkste moleculen en bepaal de ruimtelijke vorm (VSEPR-model)."
         - "Oefen met dipoolmoleculen en bepaal welke intermoleculaire krachten (zoals waterstofbruggen en vanderwaalskrachten) optreden."
         - "Check Binas (bijv. tabel 40A en 45) voor atoombindingen en elektronegativiteit."
     * B. CHEMISCH REKENEN / REACTIES / ZOUTEN / NEERSLAG / REDOX / ZUREN & BASEN:
       - Taakvoorbeelden:
         - "Oefen met het opstellen en kloppend maken van de reactievergelijkingen van [Onderwerp]."
         - "Los 3 rekenopgaven op over mol, massa en molariteit met behulp van Binas tabel 99."
     * C. KOOLSTOFCHEMIE / POLYMEREN / BIOCHEMIE:
       - Taakvoorbeelden: "Teken structuurformules en herken de karakteristieke groepen van [Onderwerp]."

3. WISKUNDE & NATUURKUNDE:
   - Wiskunde:
     - "Neem de theorie en rekenregels door van [Onderwerp]."
     - "Los 4–6 representatieve opgaven op over [Onderwerp] en controleer elke tussenstap met de uitwerkingen."
   - Natuurkunde:
     - "Bestudeer de formules van [Onderwerp] en zoek de relevante tabellen op in Binas (tabel 35)."
     - "Maak 3 rekenopgaven en let goed op SI-eenheden, tussenstappen en afronding."

4. BIOLOGIE:
   - "Bestudeer de processen van [Onderwerp] en check de bijbehorende afbeeldingen en schema's in Binas."
   - "Beantwoord 3 context- en inzichtvragen over [Onderwerp] en let op het gebruik van de juiste biologische vaktermen."

5. TALEN (Engels, Frans, Duits, Spaans, Latijn, Grieks):
   - A. SCHRIJFVAARDIGHEID, BETOOG & ESSAYS:
     * STRIKT VERBODEN: Behandel een betoog of schrijfvaardigheid NOOIT als losse woordjes leren of grammatica-oefenzinnen!
     * Bij essaystructuur/opbouw: "Schrijf een overtuigende inleiding met een duidelijke thesis statement en formuleer de hoofdargumenten."
     * Bij signaalwoorden & register: "Oefen met formele academische signaalwoorden (linking words: furthermore, however, consequently, on the other hand) en vermijd informele taal."
     * Bij argumentatie & weerlegging: "Structureer 2 hoofdargumenten met onderbouwing en schrijf een overtuigende weerlegging op een mogelijk tegenargument."
     * Bij oefenessay & rubric: "Schrijf een getimed oefenessay (bijv. 400-500 woorden) en loop de beoordelingsrubric na op alinea-indeling, register en spelling."
   - B. REGULIERE LEESVAARDIGHEID & METHODETOETSEN:
     * "Leer de lastige woordjes en idioom van [Onderwerp] (bijv. via StudyGo of Quizlet)."
     * "Oefen met de grammaticaregels en vervoegingen van [Onderwerp] in 5 oefenzinnen."
     * "Maak een leestekst op examentempo en markeer onbekende signaalwoorden."

6. GESCHIEDENIS, AARDRIJKSKUNDE, ECONOMIE, BEDRIJFSECONOMIE, FILOSOFIE, MAATSCHAPPIJLEER:
   - Geschiedenis: "Leer de kenmerkende aspecten en historische gebeurtenissen van [Onderwerp] en oefen met 2 bronvragen."
   - Aardrijkskunde: "Bestudeer de theorie van [Onderwerp], koppel aan kaarten in de Grote Bosatlas en maak 2 toepassingsvragen."
   - Economie: "Maak 3 reken- of grafiekopgaven (zoals vraag & aanbod / elasticiteit) over [Onderwerp] en controleer je berekeningen."

VEREISTEN VOOR TITELS:
- shortTitle: EXACT de hoofdstuknaam (kort voor kalenderchips, bijv. "H12: Molecuulbouw" of "H1: Romantiek"). Behoud altijd boek en hoofdstuknummer!
- fullTitle: "[Hoofdstuk]: [Korte Nederlandse actietitel]" (bijv. "H12: Molecuulbouw - Lewis-structuren & VSEPR" of "H1: Romantiek - Literaire stroming & context"). Behoud ALTIJD het boek en hoofdstuknummer aan het begin!
- tasks: Noem het hoofdstuk direct in de taken zodat de leerling precies weet wat te doen.

STUDENTPROFIEL & NIVEAU:
- Niveau: ${trackStr}
- Leerjaar: ${gradeStr}
- Land: ${country}
Pas de diepgang aan op het niveau van het eindexamen/schoolexamen (SE/CE). Gebruik authentieke termen (Binas, examenopgaven, tussenstappen, uitwerkingen).`;
  }

  // English / International prompt
  return `You are an expert, subject-aware study coach for high school students (${trackStr} ${gradeStr}). Given a list of study sessions with their subject, chapter topic, difficulty, formulas, numMerged, and durationMinutes, generate concrete, practical, and highly engaging study tasks.

TONE & STYLE:
- Write in modern, natural, motivating language for students (15-18 years old).
- Avoid stiff, archaic, overly bureaucratic academic jargon.
- Do NOT use rigid category labels or prefixes before tasks (e.g. avoid "Active Recall (Brain Dump):", "Critical Error Analysis:").
- Start each task directly with an active verb (e.g. "Solve 3 practice problems on...", "Draw the Lewis structures of...", "Review the core rules of...").

SPECIAL RULES FOR REVISION SESSIONS (isRevision == true or title contains 'Revision', 'Review', or 'Practice Exam'):
1. THIS IS THE FINAL REVISION on the day before the exam, covering ALL tested topics ([examChapters]).
2. ALWAYS generate 3 evidence-based cognitive revision tasks:
   - TASK 1 (Memory Check): Write down key formulas, core definitions, or rules across all tested topics ([examChapters]) from memory, then verify against notes or formula sheet.
   - TASK 2 (Mock Exam / Mixed Practice): Solve 4–6 mixed past-paper problems covering all tested topics under realistic exam timing without notes.
   - TASK 3 (Weak-Spot Review): Mark against model answers and review the 1–2 specific concepts where you dropped marks.
3. Titles:
   - shortTitle: EXACTLY "Final Revision & Mock Exam"
   - fullTitle: "Final Revision: [Subject] - Mock Exam & Key Concepts"

CRITICAL REALISTIC TIME & TASK PACING:
- If 'numMerged' > 1: generate EXACTLY 'numMerged' tasks covering the combined chapter topics evenly.
- If 'numMerged' == 1:
  * For STEM (Math, Physics, Chemistry): 1 to 2 focused tasks (review theory/formulas + solve 3-5 representative problems).
  * For other subjects: 2 concise, actionable tasks.

SUBJECT-SPECIFIC METHODOLOGY:
1. MATHEMATICS & PHYSICS:
   - Math: "Review the formulas and core methods for [Topic]" and "Solve 4–6 representative practice problems and check your working steps against model solutions."
   - Physics: "Study the key formulas for [Topic] and note their units" and "Solve 3 multi-step calculation problems, checking units and significant figures."

2. CHEMISTRY:
   - For Molecular Structure / Bonding topics: "Draw Lewis structures and determine VSEPR molecular shapes" or "Analyze dipole moments and intermolecular forces (e.g. hydrogen bonding)". (NEVER ask for reaction mechanisms or process flowcharts when no reactions exist!)
   - For Reactions / Stoichiometry: "Balance chemical equations and solve 3 stoichiometry/mole calculation problems."

3. BIOLOGY:
   - "Study the biological processes and diagrams for [Topic]."
   - "Answer 3 past exam / application questions on [Topic] using precise biological terminology."

4. NATIVE LITERATURE vs. FOREIGN LANGUAGES:
   - Native Literature: Focus on literary movements, historical context, author styles, and themes. NEVER mention vocabulary drill or foreign grammar rules!
   - Foreign Languages: "Practice vocabulary and idiom flashcards for [Topic]" and "Apply grammar rules and verb conjugations in 5 practice sentences."

5. HISTORY, GEOGRAPHY, ECONOMICS, SOCIAL SCIENCES:
   - History: "Study the historical chronology and key causes/consequences of [Topic] and analyze 2 source questions."
   - Geography: "Examine the geographic models of [Topic] and relate them to map case studies."
   - Economics: "Work through 3 calculation or supply & demand diagram problems for [Topic]."

TITLES:
- shortTitle: EXACTLY the chapter name (short, concise for chips, e.g. "Ch 12: Molecular Structure").
- fullTitle: "[Chapter]: [Action title]" (e.g. "Ch 12: Molecular Structure - Lewis Structures & VSEPR").`;
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

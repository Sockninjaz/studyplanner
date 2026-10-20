export type StudyLanguage = 'nl' | 'en' | 'de' | 'fr' | 'es';

const DUTCH_KEYWORDS = [
  'natuurkunde', 'wiskunde', 'scheikunde', 'biologie', 'aardrijkskunde',
  'geschiedenis', 'maatschappijleer', 'economie', 'nederlands', 'filosofie',
  'frans', 'duits', 'engels', 'grieks', 'latijn',
  'hoofdstuk', 'leerstof', 'toets', 'schoolexamen', 'examen', 'toetsweek',
  'opgaven', 'oefenopgaven', 'oefenen', 'theorie', 'begrippen', 'kernbegrippen',
  'krachten', 'kracht', 'beweging', 'energie', 'arbeid', 'differentiëren',
  'functies', 'vergelijkingen', 'formules', 'uitwerkingen', 'domein', 'domeinen',
  'leerdoelen', 'paragraaf', 'polaris', 'pulsar', 'nova', 'chemie overal',
  'biologie voor jou', 'getal en ruimte', 'moderne wiskunde', 'binas', 'samenvatting',
  'deel', 'stof', 'examenstof'
];

const GERMAN_KEYWORDS = [
  'physik', 'mathematik', 'chemie', 'biologie', 'geschichte', 'geographie',
  'deutsch', 'englisch', 'kapitel', 'prüfung', 'klausur', 'aufgaben',
  'übungen', 'lösung', 'theorie', 'begriffe'
];

const FRENCH_KEYWORDS = [
  'physique', 'mathématiques', 'chimie', 'biologie', 'histoire', 'géographie',
  'français', 'anglais', 'chapitre', 'examen', 'épreuve', 'exercices',
  'devoir', 'corrigé', 'notions'
];

const SPANISH_KEYWORDS = [
  'física', 'matemáticas', 'química', 'biología', 'historia', 'geografía',
  'español', 'inglés', 'capítulo', 'examen', 'prueba', 'ejercicios',
  'tarea', 'solución', 'conceptos'
];

/**
 * Resolves the appropriate study language ('nl', 'en', 'de', 'fr', 'es')
 * based on the uploaded material / text context and the user's onboarding profile.
 */
export function resolveStudyLanguage(
  userProfile?: {
    country?: string | null;
    countryName?: string | null;
    academicTier?: string | null;
    grade?: string | null;
  } | null,
  textContext?: string | string[] | null
): StudyLanguage {
  // 1. Analyze text context (chapters, subject, syllabus)
  let text = '';
  if (Array.isArray(textContext)) {
    text = textContext.filter(Boolean).join(' ').toLowerCase();
  } else if (typeof textContext === 'string') {
    text = textContext.toLowerCase();
  }

  if (text.length > 0) {
    let dutchScore = 0;
    for (const kw of DUTCH_KEYWORDS) {
      if (text.includes(kw)) dutchScore += 2;
    }
    // Check Dutch functional words
    if (/\b(en|van|het|de|een|voor|met|op|in|aan|te|bij|uit|als|door|over|maar|naar)\b/.test(text)) {
      dutchScore += 3;
    }

    let germanScore = 0;
    for (const kw of GERMAN_KEYWORDS) {
      if (text.includes(kw)) germanScore += 2;
    }
    if (/\b(und|der|die|das|von|für|mit|auf|in|an|bei|aus|nach|oder|aber)\b/.test(text)) {
      germanScore += 3;
    }

    let frenchScore = 0;
    for (const kw of FRENCH_KEYWORDS) {
      if (text.includes(kw)) frenchScore += 2;
    }
    if (/\b(et|de|du|la|le|les|des|pour|avec|sur|dans)\b/.test(text)) {
      frenchScore += 3;
    }

    let spanishScore = 0;
    for (const kw of SPANISH_KEYWORDS) {
      if (text.includes(kw)) spanishScore += 2;
    }
    if (/\b(y|de|el|la|los|las|para|con|en|por)\b/.test(text)) {
      spanishScore += 3;
    }

    if (dutchScore >= 2 && dutchScore > germanScore && dutchScore > frenchScore && dutchScore > spanishScore) {
      return 'nl';
    }
    if (germanScore >= 3 && germanScore > dutchScore) return 'de';
    if (frenchScore >= 3 && frenchScore > dutchScore) return 'fr';
    if (spanishScore >= 3 && spanishScore > dutchScore) return 'es';
  }

  // 2. Fall back to user onboarding profile
  if (userProfile) {
    const c = (userProfile.country || '').trim().toUpperCase();
    const cName = (userProfile.countryName || '').trim().toLowerCase();
    const tier = (userProfile.academicTier || '').trim().toLowerCase();
    const grade = (userProfile.grade || '').trim().toLowerCase();

    // Dutch criteria
    if (c === 'NL' || cName.includes('netherland') || cName.includes('nederland')) {
      return 'nl';
    }
    if (/vwo|havo|vmbo/.test(tier)) {
      return 'nl';
    }
    if (/klas/.test(grade)) {
      return 'nl';
    }

    // German criteria
    if (c === 'DE' || c === 'AT' || cName.includes('germany') || cName.includes('deutschland') || cName.includes('austria') || cName.includes('österreich')) {
      return 'de';
    }

    // French criteria
    if (c === 'FR' || cName.includes('france')) {
      return 'fr';
    }

    // Spanish criteria
    if (c === 'ES' || cName.includes('spain') || cName.includes('españa')) {
      return 'es';
    }
  }

  // Default to English for international
  return 'en';
}

/**
 * Returns localized session prefix, e.g. "Studeren" for Dutch, "Study" for English.
 */
export function getStudySessionPrefix(lang: StudyLanguage): string {
  switch (lang) {
    case 'nl': return 'Studeren';
    case 'de': return 'Lernen';
    case 'fr': return 'Étudier';
    case 'es': return 'Estudiar';
    case 'en':
    default:
      return 'Study';
  }
}

/**
 * Returns clean fallback tasks localized to the target study language.
 */
export function getDefaultFallbackTasks(rawChapter: string, lang: StudyLanguage) {
  switch (lang) {
    case 'nl':
      return [
        {
          id: 'task-0',
          text: `Theorie en kernbegrippen doornemen voor ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Oefenopgaven maken en nakijken over ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    case 'de':
      return [
        {
          id: 'task-0',
          text: `Konzepte und Kerninhalte durchgehen für ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Übungsaufgaben lösen und überprüfen zu ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    case 'fr':
      return [
        {
          id: 'task-0',
          text: `Revoir les concepts et le cours pour ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Faire des exercices d'entraînement sur ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    case 'es':
      return [
        {
          id: 'task-0',
          text: `Repasar conceptos clave y teoría de ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Resolver ejercicios prácticos sobre ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    case 'en':
    default:
      return [
        {
          id: 'task-0',
          text: `Review concepts and key materials for ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Complete practice problems and self-test on ${rawChapter}`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
  }
}

/**
 * Returns single concise fallback task localized to the target study language.
 */
export function getSingleFallbackTask(rawChapter: string, lang: StudyLanguage) {
  switch (lang) {
    case 'nl':
      return { id: 'task-0', text: `Theorie en oefenopgaven voor ${rawChapter}`, completed: false, sessionsCompleted: 0 };
    case 'de':
      return { id: 'task-0', text: `Theorie und Übungen für ${rawChapter}`, completed: false, sessionsCompleted: 0 };
    case 'fr':
      return { id: 'task-0', text: `Étudier le cours et les exercices de ${rawChapter}`, completed: false, sessionsCompleted: 0 };
    case 'es':
      return { id: 'task-0', text: `Estudiar teoría y ejercicios de ${rawChapter}`, completed: false, sessionsCompleted: 0 };
    case 'en':
    default:
      return { id: 'task-0', text: `Study ${rawChapter}`, completed: false, sessionsCompleted: 0 };
  }
}

/**
 * Formats a clean list of chapter numbers or names for task text.
 * e.g. ["H12: Molecuulbouw. Chemie Overal", "H13: Kunststoffen. Chemie Overal"] -> "H12, H13"
 */
export function formatChapterSummary(chapters: string[]): string {
  if (!chapters || chapters.length === 0) return '';
  
  const labels = chapters
    .filter(ch => !/\b(herhaling|proeftoets|revision|review)\b/i.test(ch))
    .map(ch => {
      const match = ch.match(/\b(H\s*\d+[a-z]?|HK|Ch\s*\d+|Chapter\s*\d+|Thema\s*\d+|Domein\s*[A-Z0-9]+)\b/i);
      if (match) return match[1].replace(/\s+/, '');
      return ch.split(/[:.-]/)[0].trim();
    })
    .filter(Boolean);

  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

export function getRevisionSessionTitles(subject: string, lang: StudyLanguage): { shortTitle: string; fullTitle: string } {
  switch (lang) {
    case 'nl':
      return {
        shortTitle: 'Eindherhaling & Proeftoets',
        fullTitle: `Eindherhaling: ${subject} - Proeftoets & Active Recall`,
      };
    case 'de':
      return {
        shortTitle: 'Abschluss-Wiederholung & Probeklausur',
        fullTitle: `Wiederholung: ${subject} - Probeklausur & Active Recall`,
      };
    case 'fr':
      return {
        shortTitle: 'Révision finale & Examen blanc',
        fullTitle: `Révision finale: ${subject} - Examen blanc & Active Recall`,
      };
    case 'es':
      return {
        shortTitle: 'Repaso final y simulacro',
        fullTitle: `Repaso final: ${subject} - Simulacro de examen y Active Recall`,
      };
    case 'en':
    default:
      return {
        shortTitle: 'Final Revision & Mock Exam',
        fullTitle: `Final Revision: ${subject} - Mock Exam & Active Recall`,
      };
  }
}

/**
 * Returns evidence-based, scientifically proven revision tasks (Active Recall,
 * Mock Exam / Interleaved Practice, and Error Analysis) tailored by subject.
 */
export function getRevisionFallbackTasks(subject: string, chapters: string[], lang: StudyLanguage) {
  const summary = formatChapterSummary(chapters);
  const sLower = (subject || '').toLowerCase();
  const allChaptersText = (chapters || []).join(' ').toLowerCase();

  const isChemistry = /scheikunde|chemie|chemistry|chimie|química/.test(sLower);
  const isPhysics = /natuurkunde|fysica|physik|physics|physique|física/.test(sLower);
  const isMath = /wiskunde|mathematik|math|calculus|algebra|matemáticas|mathématiques/.test(sLower);
  const isBiology = /biologie|biology|biología/.test(sLower);
  const isHumanities = /geschiedenis|history|histoire|geschichte|aardrijkskunde|geografie|geography|geographie|economie|economics|wirtschaft|filosofie|philosophy|maatschappijleer|sociaal/.test(sLower);
  const isDutch = /nederlands|dutch/.test(sLower);
  const isLiterature = isDutch && /literatuur|romantiek|verlichting|middeleeuwen|renaissance|realisme|modernisme|gedicht|poëzie|boek|leesdossier/.test(`${sLower} ${allChaptersText}`);
  const isForeignLanguage = /engels|english|frans|french|duits|german|deutsch|spaans|spanish|español|latijn|latin|grieks|greek/.test(sLower);
  const isLanguage = isDutch || isForeignLanguage;

  if (lang === 'nl') {
    const stofStr = summary ? `alle getoetste stof (${summary})` : `alle getoetste stof van ${subject}`;

    if (isChemistry) {
      return [
        {
          id: 'task-0',
          text: `Schrijf de belangrijkste concepten, formules en Binas-tabellen van ${stofStr} uit je hoofd op en check wat je mist.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Maak 4–6 gemengde examenvragen over ${summary || 'de getoetste hoofdstukken'} onder examentijd zonder in je boek te kijken.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met de uitwerkingen en herhaal direct de 1 of 2 onderdelen waar je punten verloor.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isPhysics) {
      return [
        {
          id: 'task-0',
          text: `Noteer de belangrijkste formules en eenheden van ${stofStr} uit je hoofd en controleer met Binas tabel 35.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Los 4–6 gemengde examenvragen op over ${summary || 'alle getoetste onderwerpen'} onder examentijd.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met de uitwerkingen en controleer je tussenstappen, berekeningen en afronding.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isMath) {
      return [
        {
          id: 'task-0',
          text: `Schrijf de belangrijkste rekenregels en formules van ${stofStr} uit je hoofd op en check je formuleoverzicht.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Maak 4–6 gevarieerde opgaven over alle getoetste hoofdstukken (${summary || 'de toetsstof'}) onder tijdsdruk.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met de uitwerkingen en werk de opgaven die je fout had opnieuw uit totdat je elke stap begrijpt.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isBiology) {
      return [
        {
          id: 'task-0',
          text: `Neem de biologische processen en Binas-afbeeldingen van ${stofStr} uit je hoofd door en check wat je mist.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Beantwoord 4–6 context- en inzichtvragen over ${summary || 'alle thema\'s'} onder examentijd en let op de juiste vaktermen.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met het correctievoorschrift en vul ontbrekende stappen of begrippen in je antwoorden aan.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isHumanities) {
      return [
        {
          id: 'task-0',
          text: `Zet de belangrijkste tijdlijnen, oorzaak-gevolgrelaties en begrippen van ${stofStr} kort op een rij.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Beantwoord 3–4 representatieve examenvragen over ${summary || 'alle onderwerpen'} (Bewering - Onderbouwing).`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met het correctievoorschrift en herhaal de begrippen die je nog niet scherp had.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isLiterature) {
      return [
        {
          id: 'task-0',
          text: `Schrijf de kenmerken van de literaire stroming(en) en de belangrijkste schrijvers/werken van ${stofStr} uit je hoofd op.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Beantwoord 2–3 analysevragen over literaire motieven, thema's en historische context van ${summary || 'de behandelde stof'}.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met de uitwerkingen en controleer of je alle literaire begrippen juist hebt toegepast.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isDutch) {
      return [
        {
          id: 'task-0',
          text: `Neem de theorie over signaalwoorden, tekstverbanden en alineafuncties van ${stofStr} door.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Maak een representatieve examentekst over ${summary || 'de getoetste stof'} onder examentijd.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met het correctievoorschrift en analyseer waarom eventuele antwoorden fout waren.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    if (isForeignLanguage) {
      return [
        {
          id: 'task-0',
          text: `Herhaal de lastige woordjes, signaalwoorden en grammaticaregels van ${stofStr}.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-1',
          text: `Maak een proeftekst of 2 examenpassages over ${summary || 'de behandelde stof'} onder examentijd.`,
          completed: false,
          sessionsCompleted: 0,
        },
        {
          id: 'task-2',
          text: `Kijk na met de uitwerkingen en noteer de onbekende woorden om te herhalen.`,
          completed: false,
          sessionsCompleted: 0,
        }
      ];
    }

    // Default Dutch
    return [
      {
        id: 'task-0',
        text: `Schrijf de belangrijkste kernconcepten en definities van ${stofStr} uit je hoofd op en check wat je mist.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-1',
        text: `Maak een selectie van 4–6 oefenvragen over ${summary || 'alle getoetste stof'} onder examencondities.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-2',
        text: `Kijk na met de uitwerkingen en neem de lastigste punten nog een keer door.`,
        completed: false,
        sessionsCompleted: 0,
      }
    ];
  }

  // English fallback tasks
  const englishScope = summary ? `all tested chapters (${summary})` : `all tested material for ${subject}`;
  if (isChemistry || isPhysics || isMath || isBiology) {
    return [
      {
        id: 'task-0',
        text: `Active Recall (Brain dump): Write down all key formulas, reaction mechanisms, and core laws of ${englishScope} from memory. Check reference sheet for gaps.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-1',
        text: `Timed Mock Exam (Mixed Practice): Solve 4–6 mixed exam-style problems covering ${summary || 'all tested chapters'} under timed conditions without checking notes.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-2',
        text: `Strict Error Analysis: Grade against the solution model; spend 10 minutes diagnosing and re-solving the questions where you lost points.`,
        completed: false,
        sessionsCompleted: 0,
      }
    ];
  }

  if (isHumanities) {
    return [
      {
        id: 'task-0',
        text: `Active Recall: Map out key timelines, cause-and-effect chains, and core terminology for ${englishScope} completely from memory.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-1',
        text: `Timed Past-Paper Questions: Answer 3–4 past exam essay/source questions on ${summary || 'all tested topics'} using Claim-Evidence-Reasoning.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-2',
        text: `Mark Scheme Audit: Compare your answers with the rubric and note any missing technical terms or arguments.`,
        completed: false,
        sessionsCompleted: 0,
      }
    ];
  }

  if (isLanguage) {
    return [
      {
        id: 'task-0',
        text: `Active Self-Quiz: Test yourself on high-yield vocabulary, connectives, and key grammar rules across ${englishScope}.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-1',
        text: `Timed Practice Passage: Complete 1–2 reading comprehension or writing exercises covering ${summary || 'all tested sections'} under exam timing.`,
        completed: false,
        sessionsCompleted: 0,
      },
      {
        id: 'task-2',
        text: `Review & Correction: Analyze answer rationale for every missed question and drill the tricky grammar patterns.`,
        completed: false,
        sessionsCompleted: 0,
      }
    ];
  }

  return [
    {
      id: 'task-0',
      text: `Active Recall (Brain dump): Brain dump all major concepts, definitions, and connections for ${englishScope} on blank paper without looking at notes.`,
      completed: false,
      sessionsCompleted: 0,
    },
    {
      id: 'task-1',
      text: `Full-Syllabus Mock Practice: Solve a mixed set of 4–6 practice questions spanning ${summary || 'the entire exam syllabus'} under realistic exam conditions.`,
      completed: false,
      sessionsCompleted: 0,
    },
    {
      id: 'task-2',
      text: `Error Analysis & Blind Spots: Mark answers with the answer key and spend focused time understanding any misconceptions.`,
      completed: false,
      sessionsCompleted: 0,
    }
  ];
}


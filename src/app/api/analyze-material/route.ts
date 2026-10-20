import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkRateLimitAsync, getClientIp, AI_RATE_LIMIT_PRESET } from '@/lib/rate-limit';
import { validateUploadFile, MAX_UPLOAD_SIZE_BYTES } from '@/lib/ai/fileValidation';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { parseDocument } from '@/lib/ai/fileParsers';
import { MATERIAL_ANALYSIS_PROMPT, buildMaterialAnalysisMessage, stripPromptArtifacts } from '@/lib/ai/prompts';
import { resolveStudyLanguage } from '@/lib/i18n/resolveStudyLanguage';
import { openai } from '@ai-sdk/openai';
import googleSearch from 'googlethis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Server-side in-memory cache for parsed document text by buffer SHA-256 hash (remembers up to 100 recent documents)
interface CachedDocEntry {
  text: string;
  pageCount: number;
  ocrText?: string;
}
const parsedDocumentCache = new Map<string, CachedDocEntry>();

function getCachedDoc(hash: string): CachedDocEntry | undefined {
  const entry = parsedDocumentCache.get(hash);
  if (entry) {
    parsedDocumentCache.delete(hash);
    parsedDocumentCache.set(hash, entry);
    return entry;
  }
  return undefined;
}

function setCachedDoc(hash: string, entry: CachedDocEntry) {
  if (parsedDocumentCache.size >= 100) {
    const oldestKey = parsedDocumentCache.keys().next().value;
    if (oldestKey) parsedDocumentCache.delete(oldestKey);
  }
  parsedDocumentCache.set(hash, entry);
}

// Zod schema for the AI's structured response
const StudyMaterialSchema = z.object({
  chapters: z.array(z.object({
    chapter: z.string().describe('The exact academic chapter or textbook chapter title. When extracting from a PTA (Programma van Toetsing en Afsluiting), syllabus table, or textbook method, you MUST format as: "H[Number]: [Topic Title]. [Book Name]" or "H[Number]: [Topic Title]" (e.g. "H1: Getallen en variabelen. Getal en Ruimte", "H3: Verbanden en grafieken. Getal en Ruimte", "H4: Arbeid en energie. Pulsar", "H3: Reacties van metalen. Nova", "H4: Voeding en vertering. Biologie voor Jou"). ALWAYS put the Chapter number and topic title FIRST, NEVER start with the long textbook name!'),
    difficulty: z.number().min(1).max(5).describe('Difficulty level 1-5'),
    confidence: z.number().min(1).max(5).describe('Expected student confidence 1-5'),
    user_estimated_total_hours: z.number().min(0.25).max(100).describe('Study hours for this chapter — cleanly rounded to 0.5 hour increments (e.g. 1.5, 2.0, 2.5), all chapters must sum to totalEstimatedHours'),
    formulas: z.array(z.string()).describe('Key formulas, equations, or scientific laws explicitly mentioned in the material for this chapter. Return an empty array if none.'),
  })),
  summary: z.string().describe('Brief summary of the overall material and tested curriculum domains'),
  isSuggestedFallback: z.boolean().describe('True if the user provided sparse input and you are generating high-level national curriculum milestones instead of concrete text extraction. False if the provided text was rich and sufficient.'),
  totalEstimatedHours: z.number().min(0.25).max(100).describe('TOTAL realistic study hours for the exam (typically 5 to 9 hours for 6 VWO; do not inflate to 20+ hours)'),
});

export type MaterialAnalysisResult = z.infer<typeof StudyMaterialSchema>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}

function cleanBookTitle(book: string): string {
  if (!book) return '';
  const lower = book.toLowerCase();
  if (lower.includes('getal')) return 'Getal en Ruimte';
  if (lower.includes('pulsar')) return 'Pulsar';
  if (lower.includes('polaris')) return 'Polaris';
  if (lower.includes('nova')) return 'Nova';
  if (lower.includes('chemie overal')) return 'Chemie Overal';
  if (lower.includes('biologie voor jou')) return 'Biologie voor Jou';
  if (lower.includes('moderne wiskunde')) return 'Moderne Wiskunde';
  if (lower.includes('systematische')) return 'Systematische Natuurkunde';
  if (lower.includes('overal natuurkunde')) return 'Overal Natuurkunde';
  if (lower.includes('campbell')) return 'Campbell Biology';
  if (lower.includes('binas')) return 'Binas';

  return book
    .replace(/\s*\b\d+e\s+editie\b/gi, '')
    .replace(/\s*\b(?:vwo|havo|vmbo)\s*\d*\b/gi, '')
    .replace(/\s*\b(?:12e|11e|10e|9e|8e|7e|6e|5e|4e|3e|2e|1e)\b/gi, '')
    .trim();
}

function cleanChapterName(name: string): string {
  let cleaned = name.trim();

  // Strip opgave / question prefixes e.g. "Opgave 1: ", "Vraag 3 - ", "Exercise 2. "
  cleaned = cleaned.replace(/^(?:opgave|vraag|toetsvraag|opgaven|exercise|question|problem)\s*\d+[\s:.-]*/i, '');

  // Strip exam code or period prefixes e.g. "SE 2: ", "SE2 - ", "Periode 3: ", "Toets 1: ", "TW1: "
  cleaned = cleaned.replace(/^(?:se\s*\d+|periode\s*\d+|toets\s*\d+|p\d+|tw\s*\d+)[\s:.-]+/i, '');

  // Strip scenario names combined with academic concepts, e.g.:
  // "Wijnfraude en Radioactieve Isotopen" -> "Radioactieve Isotopen"
  // "Nuclidetherapie en Alfastralers" -> "Alfastralers en Kernverval"
  cleaned = cleaned.replace(/^(?:wijnfraude|nuclidetherapie|fietsdynamo|speelgoedraket|autobotsing)\s*(?:en|&|:|-|\/)\s*/i, '');
  cleaned = cleaned.replace(/\s*(?:en|&|-|\/)\s*(?:wijnfraude|nuclidetherapie|fietsdynamo|speelgoedraket|autobotsing)$/i, '');

  // If the title itself is just the scenario word:
  if (/^wijnfraude$/i.test(cleaned)) {
    cleaned = 'Radioactiviteit en Isotopen';
  } else if (/^nuclidetherapie$/i.test(cleaned)) {
    cleaned = 'Kernfysica en Stralingsverval';
  }

  // Flip: "[Book Name] H[Number]: [Topic Title]" -> "H[Number]: [Topic Title]. [Book Name]"
  // e.g. "Getal en Ruimte Wiskunde A 12e editie H5: Machtsverbanden en exponentiële formules" -> "H5: Machtsverbanden en exponentiële formules. Getal en Ruimte"
  const bookPrefixMatch = cleaned.match(/^(.+?)\s+((?:H\s*\d+[a-z]?|HK|Chapter\s*\d+|Ch\s*\d+|Thema\s*\d+|Domein\s*[A-Z0-9]+)\s*[:.-]\s*)(.+)$/i);
  if (bookPrefixMatch) {
    const rawBook = bookPrefixMatch[1].trim();
    const chTag = bookPrefixMatch[2].trim();
    const topic = bookPrefixMatch[3].trim();
    const simplifiedBook = cleanBookTitle(rawBook);

    cleaned = simplifiedBook ? `${chTag} ${topic}. ${simplifiedBook}` : `${chTag} ${topic}`;
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Combines earlier foundational chapters into 1 "Voorkennis" review topic
 * when an exam covers 5, 6, or more chapters (which otherwise equals ~25-30 paragraphs).
 */
function combineVoorkennisChapters(chapters: any[], isDutch: boolean): any[] {
  if (!chapters || chapters.length < 5) return chapters;

  // If any chapter already represents a combined voorkennis or review topic, skip
  const alreadyCombined = chapters.some(ch =>
    /\b(voorkennis|herhaling|foundations|review|prerequisite)\b/i.test(ch.chapter)
  );
  if (alreadyCombined) return chapters;

  // In a 5+ chapter test, merge the first 2 (or 3 if 7+ chapters) foundational chapters
  const numToMerge = chapters.length >= 7 ? 3 : 2;
  const toMerge = chapters.slice(0, numToMerge);
  const remaining = chapters.slice(numToMerge);

  // Extract chapter tags and book name if available
  const chapterLabels: string[] = [];
  let detectedBook = '';

  for (const ch of toMerge) {
    const chNumMatch = ch.chapter.match(/^(?:H(?:oofdstuk)?|Ch(?:apter)?\.?)\s*(\d+[a-z]?)/i);
    if (chNumMatch) {
      chapterLabels.push(`H${chNumMatch[1]}`);
    }
    const bookMatch = ch.chapter.match(/\.\s*([A-Za-z0-9\s&]+)$/);
    if (bookMatch && !detectedBook) {
      detectedBook = bookMatch[1].trim();
    }
  }

  const labelStr = chapterLabels.length > 0
    ? (chapterLabels.length === 2 ? `${chapterLabels[0]} & ${chapterLabels[1]}` : `${chapterLabels.slice(0, -1).join(', ')} & ${chapterLabels[chapterLabels.length - 1]}`)
    : (isDutch ? 'H1 & H2' : 'Ch 1 & Ch 2');

  const combinedTitle = isDutch
    ? `${labelStr}: Voorkennis & Basis (Herhaling)${detectedBook ? `. ${detectedBook}` : ''}`
    : `${labelStr}: Foundations & Review${detectedBook ? `. ${detectedBook}` : ''}`;

  const mergedFormulas = Array.from(new Set(toMerge.flatMap((c: any) => c.formulas || [])));

  const combinedChapter = {
    chapter: combinedTitle,
    difficulty: 2,
    confidence: 4,
    user_estimated_total_hours: numToMerge === 3 ? 1.5 : 1.0,
    formulas: mergedFormulas,
  };

  return [combinedChapter, ...remaining];
}

/**
 * Intelligently locates and extracts the relevant section of a multi-subject school PTA or syllabus.
 * High schools typically publish a single 50-100 page master PTA containing all subjects.
 * This finds where the authentic target subject syllabus starts (skipping the Table of Contents),
 * ensuring it is never cut off even if it appears on page 50+.
 */
function locateRelevantSyllabusSection(fullText: string, subject: string, specialInstructions?: string, textbookName?: string): string {
  if (!fullText || fullText.length < 3000) return fullText;

  const normSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, '');
  const subjectAliases: Record<string, string[]> = {
    wiskunde: ['wiskunde a', 'wiskunde-a', 'wiskunde b', 'wiskunde-b', 'wiskunde c', 'wiskunde-c', 'wiskunde'],
    wiskundea: ['wiskunde a', 'wiskunde-a', 'wis a', 'wia'],
    wiskundeb: ['wiskunde b', 'wiskunde-b', 'wis b', 'wib'],
    wiskundec: ['wiskunde c', 'wiskunde-c', 'wis c', 'wic'],
    natuurkunde: ['natuurkunde', 'fysica', 'physics', 'nat', 'na'],
    scheikunde: ['scheikunde', 'chemie', 'chemistry', 'sk'],
    biologie: ['biologie', 'biology', 'bio'],
    geschiedenis: ['geschiedenis', 'history', 'gs'],
    aardrijkskunde: ['aardrijkskunde', 'geografie', 'geography', 'ak'],
    economie: ['economie', 'economics', 'econ', 'ec'],
    bedrijfseconomie: ['bedrijfseconomie', 'beco', 'm&o'],
    nederlands: ['nederlands', 'dutch', 'ne'],
    engels: ['engels', 'english', 'en'],
    frans: ['frans', 'french', 'fa'],
    duits: ['duits', 'german', 'du'],
  };

  let aliases = subjectAliases[normSubject] || [subject.toLowerCase()];

  // Disambiguate wiskunde if specialInstructions or textbook mentions 'wis a', 'wis b', etc.
  const extraContext = `${specialInstructions || ''} ${textbookName || ''} ${subject}`.toLowerCase();
  if (normSubject === 'wiskunde') {
    if (extraContext.includes('wis a') || extraContext.includes('wiskunde a') || extraContext.includes('wia')) {
      aliases = ['wiskunde a', 'wiskunde-a', 'wis a', 'wia', 'wiskunde'];
    } else if (extraContext.includes('wis b') || extraContext.includes('wiskunde b') || extraContext.includes('wib')) {
      aliases = ['wiskunde b', 'wiskunde-b', 'wis b', 'wib', 'wiskunde'];
    } else if (extraContext.includes('wis c') || extraContext.includes('wiskunde c') || extraContext.includes('wic')) {
      aliases = ['wiskunde c', 'wiskunde-c', 'wis c', 'wic', 'wiskunde'];
    }
  }

  // Find all candidate occurrences across the document
  const matches: Array<{ pos: number; alias: string }> = [];
  for (const alias of aliases) {
    let pos = 0;
    while ((pos = fullText.toLowerCase().indexOf(alias, pos)) !== -1) {
      matches.push({ pos, alias });
      pos += alias.length;
    }
  }

  let bestMatch: number | null = null;
  let bestScore = -1;

  for (const m of matches) {
    const pos = m.pos;
    const snippet = fullText.substring(pos, pos + 500);
    const prevSnippet = fullText.substring(Math.max(0, pos - 150), pos);
    
    let score = 0;

    // Table of contents penalty: dots or page listings (e.g. "WISKUNDE A .................... 50")
    if (snippet.includes('.....') || snippet.includes('. . . .') || /\.\s*\.\s*\.\s*\./.test(snippet)) {
      score -= 100;
    }
    if (prevSnippet.includes('.....') || /\.\s*\.\s*\.\s*\./.test(prevSnippet)) {
      score -= 100;
    }

    // Strong syllabus curriculum table indicators
    if (/methode\s*:/i.test(snippet)) score += 35;
    if (/toetscode/i.test(snippet)) score += 35;
    if (/jaarlaag\s*:/i.test(snippet)) score += 25;
    if (/leerstof\s*:/i.test(snippet)) score += 25;
    if (/domeinen\s*:/i.test(snippet)) score += 25;
    if (/schoolexamen/i.test(snippet)) score += 20;
    if (/weegfactor/i.test(snippet)) score += 20;
    if (/tijdsduur/i.test(snippet)) score += 20;
    if (/moment\s*:/i.test(snippet)) score += 20;
    if (/leerdoelen/i.test(snippet)) score += 20;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = pos;
    }
  }

  // If score > 0, we found the authentic syllabus section!
  if (bestMatch !== null && bestScore > 0) {
    const start = Math.max(0, bestMatch - 200);
    const end = Math.min(fullText.length, bestMatch + 45000);
    return fullText.substring(start, end);
  }

  // Fallback: check if specialInstructions has a specific exam code or keyword (e.g. WIA6VT5 or Tentamen II)
  if (specialInstructions) {
    const words = specialInstructions.split(/\s+/).filter(w => w.length >= 4);
    for (const w of words) {
      const idx = fullText.toLowerCase().indexOf(w.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 500);
        const end = Math.min(fullText.length, idx + 45000);
        return fullText.substring(start, end);
      }
    }
  }

  return fullText;
}


export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 5 requests per 10 minutes per IP
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitAsync(ip, 'analyze-material', AI_RATE_LIMIT_PRESET);
    
    if (!rateLimit.success) {
      const retrySec = Math.ceil(rateLimit.resetMs / 1000);
      return NextResponse.json(
        { error: `Te veel verzoeken. Probeer het over ${Math.ceil(retrySec / 60)} minuten opnieuw. (Max 5 verzoeken per 10 minuten).` },
        { status: 429, headers: { 'Retry-After': retrySec.toString() } }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const rawText = stripPromptArtifacts(formData.get('rawText') as string | null);
    const cachedExtractedText = stripPromptArtifacts((formData.get('cachedExtractedText') as string | null)?.trim() || null);
    const clientFileNames = (formData.get('fileNames') as string | null)?.trim() || null;
    const subjectName = (formData.get('subjectName') as string || 'Unknown Subject').trim();
    const examDate = formData.get('examDate') as string || 'TBD';
    let specialInstructions = stripPromptArtifacts(formData.get('specialInstructions') as string | null);
    const textbookName = (formData.get('textbookName') as string | null)?.trim() || null;

    // If no explicit specialInstructions provided, but rawText starts with a short exam/period directive (e.g. "VWO6 wis a SE november")
    if (!specialInstructions && rawText) {
      const lines = rawText.trim().split('\n');
      if (lines.length > 1 && lines[0].trim().length < 80 && /(?:vwo|havo|se|periode|toets|tentamen|examen|tw|nov|mrt|jun|sep)/i.test(lines[0])) {
        specialInstructions = lines[0].trim();
      }
    }

    // Fetch user profile and saved subject textbooks
    const session = await getServerSession(authOptions);
    let userProfile = undefined;
    let savedTextbook: string | undefined = undefined;
    let userDoc: any = null;

    if (session?.user?.email) {
      await dbConnect();
      userDoc = await User.findOne({ email: session.user.email });
      if (userDoc?.onboardingProfile) {
        userProfile = userDoc.onboardingProfile;
      }
      if (userDoc?.subject_textbooks) {
        const match = userDoc.subject_textbooks.find(
          (st: any) => st.subject.toLowerCase() === subjectName.toLowerCase()
        );
        if (match?.textbook) {
          savedTextbook = match.textbook;
        }
      }

      // Auto-save textbook to profile if explicitly provided by user
      if (textbookName) {
        if (!userDoc.subject_textbooks) {
          userDoc.subject_textbooks = [];
        }
        const existingIdx = userDoc.subject_textbooks.findIndex(
          (st: any) => st.subject.toLowerCase() === subjectName.toLowerCase()
        );
        if (existingIdx >= 0) {
          userDoc.subject_textbooks[existingIdx].textbook = textbookName;
          userDoc.subject_textbooks[existingIdx].updatedAt = new Date();
        } else {
          userDoc.subject_textbooks.push({
            subject: subjectName,
            textbook: textbookName,
            updatedAt: new Date(),
          });
        }
        await userDoc.save();
        console.log(`[analyze-material] Auto-saved textbook "${textbookName}" for subject "${subjectName}"`);
      }
    }

    const resolvedTextbook = textbookName || savedTextbook;

    if (!userProfile) {
      userProfile = {
        countryName: 'Netherlands',
        academicTierLabel: 'VWO',
        gradeLabel: 'Klas 6',
        academicTier: 'vwo',
        grade: 'klas-6',
        examBoardLabel: 'National Curriculum (Centraal Examen / Schoolexamen)'
      };
    }

    if (!cachedExtractedText && files.length === 0 && (!rawText || rawText.trim().length === 0)) {
      return NextResponse.json({ error: 'Upload ten minste één bestand of voer tekst in.' }, { status: 400 });
    }

    let textToAnalyze = '';
    let parsedFileInfo = {
      type: 'mixed',
      pageCount: 0,
      textLength: 0,
      names: [] as string[]
    };

    if (cachedExtractedText && cachedExtractedText.length > 0) {
      console.log(`[analyze-material] Using client-provided cached document text (${cachedExtractedText.length} chars) - skipped re-reading files`);
      textToAnalyze = cachedExtractedText;
      parsedFileInfo.textLength = cachedExtractedText.length;
      parsedFileInfo.names = clientFileNames ? clientFileNames.split(', ') : ['Remembered Syllabus File'];
      parsedFileInfo.type = 'cached-document';
    } else if (files.length > 0) {
      console.log(`[analyze-material] Parsing ${files.length} files`);
      
      for (const file of files) {
        // Enforce 4 MB max cap
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          return NextResponse.json(
            { error: `Bestand ${file.name} overschrijdt de maximale limiet van 4 MB.` },
            { status: 413 }
          );
        }
        
        const buffer = Buffer.from(await file.arrayBuffer());

        // Validate MIME & magic bytes
        const validation = validateUploadFile(buffer, file.type);
        if (!validation.valid) {
          return NextResponse.json(
            { error: `${file.name}: ${validation.error}` },
            { status: 415 }
          );
        }

        let fileName = file.name;
        if (!fileName.includes('.')) {
          fileName += validation.detectedType === 'pdf' ? '.pdf' : '.png';
        }

        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        const cachedDoc = getCachedDoc(fileHash);

        if (cachedDoc) {
          console.log(`[analyze-material] Cache HIT for ${file.name} (${fileHash.slice(0, 8)}) - 0ms parsing`);
          if (cachedDoc.text.trim().length > 0) {
            textToAnalyze += `\n\n--- Document: ${fileName} ---\n\n${cachedDoc.text}`;
          }
          if (cachedDoc.ocrText && cachedDoc.ocrText.trim().length > 0) {
            textToAnalyze += `\n\n--- Extracted Material from ${fileName} ---\n${cachedDoc.ocrText}`;
          }
          parsedFileInfo.pageCount += cachedDoc.pageCount;
          parsedFileInfo.names.push(fileName);
        } else {
          console.log(`[analyze-material] Parsing ${file.name} (${file.type}, ${file.size} bytes)`);
          const ext = fileName.toLowerCase().split('.').pop() || '';
          const isImage = (file.type && file.type.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'gif', 'svg'].includes(ext);
          const isPdf = file.type === 'application/pdf' || ext === 'pdf' || (buffer.length > 4 && buffer.slice(0, 4).toString('ascii') === '%PDF');
          const resolvedMime = file.type && file.type !== 'application/octet-stream'
            ? file.type
            : (isImage ? `image/${ext === 'jpg' ? 'jpeg' : (ext || 'png')}` : isPdf ? 'application/pdf' : 'application/octet-stream');

          const parsed = await parseDocument(buffer, fileName);
          console.log(`[analyze-material] Extracted ${parsed.text.length} chars from ${file.name}`);
          
          if (parsed.text.trim().length > 0) {
            textToAnalyze += `\n\n--- Document: ${fileName} ---\n\n${parsed.text}`;
          }
          parsedFileInfo.pageCount += (parsed.pageCount ?? 0);
          parsedFileInfo.names.push(fileName);
          
          let ocrText: string | undefined = undefined;
          // Multimodal Vision OCR for images/screenshots or scanned PDFs with sparse text
          if (isImage || (isPdf && parsed.text.trim().length < 50)) {
            console.log(`[analyze-material] Running Multimodal Vision OCR for ${fileName} (${resolvedMime})...`);
            try {
              const { extractTextFromMultimodal } = await import('@/lib/ai/aiClient');
              ocrText = await extractTextFromMultimodal(buffer, resolvedMime, specialInstructions || undefined);
              if (ocrText && ocrText.trim().length > 0) {
                console.log(`[analyze-material] Vision OCR successful for ${fileName} (${ocrText.length} chars).`);
                textToAnalyze += `\n\n--- Extracted Material from ${fileName} ---\n${ocrText}`;
              }
            } catch (ocrErr: any) {
              console.error(`[analyze-material] Vision OCR failed for ${fileName}:`, ocrErr);
            }
          }

          setCachedDoc(fileHash, {
            text: parsed.text,
            pageCount: parsed.pageCount ?? 0,
            ocrText,
          });
        }
      }
      
      parsedFileInfo.textLength = textToAnalyze.length;
    } else if (rawText) {
      const trimmedText = rawText.trim();
      const isUrl = /^https?:\/\/[^\s]+$/.test(trimmedText);

      if (isUrl) {
        console.log(`[analyze-material] Fetching content from URL: ${trimmedText}`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(trimmedText, {
            signal: controller.signal,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
          }

          const html = await response.text();
          // Use our existing HTML parser
          const parsed = await parseDocument(Buffer.from(html), 'website_content.html');
          
          textToAnalyze = parsed.text;
          parsedFileInfo.type = 'website';
          parsedFileInfo.textLength = textToAnalyze.length;
          
          console.log(`[analyze-material] Successfully extracted ${textToAnalyze.length} chars from website`);
        } catch (err: any) {
          console.error('[analyze-material] URL fetch error:', err);
          const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
          return NextResponse.json({ error: `Could not read the website: ${errorMsg}. Please try copy-pasting the text instead.` }, { status: 500 });
        }
      } else {
        textToAnalyze = rawText;
        parsedFileInfo.textLength = rawText.length;
      }
    }

    if (textToAnalyze.trim().length < 3) {
      if (files.length > 0) {
        return NextResponse.json(
          { error: 'Could not extract readable text or syllabus topics from the uploaded file(s). Please try uploading a clearer image/PDF or enter your topics manually.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Input is too short. Please provide at least a topic or chapter description.' },
        { status: 400 }
      );
    }

    // Preserve raw clean extracted document text before isolation so client can cache and reuse it
    const rawDocumentText = stripPromptArtifacts(textToAnalyze);

    // Intelligently isolate subject section if full document contains multiple subjects or is a large school PTA
    const isolatedSection = locateRelevantSyllabusSection(
      rawDocumentText,
      subjectName,
      specialInstructions || undefined,
      resolvedTextbook || undefined
    );
    const hasDistinctSection = isolatedSection !== rawDocumentText && isolatedSection.length < rawDocumentText.length * 0.95;
    
    // The clean student material text for this subject (WITHOUT ANY AI INSTRUCTIONS OR PROMPT WRAPPERS)
    const cleanMaterialText = (hasDistinctSection ? isolatedSection : rawDocumentText).trim();

    // Prepare prompt text for AI with context wrappers (used ONLY for the AI model prompt, NEVER returned as rawText)
    let promptTextForAi = cleanMaterialText;
    if (hasDistinctSection) {
      console.log(`[analyze-material] Successfully isolated ${isolatedSection.length} chars section for ${subjectName}`);
      promptTextForAi = `Subject: ${subjectName}

=== TARGET SUBJECT & EXAM SECTION LOCATED IN DOCUMENT FOR ${subjectName.toUpperCase()} ===
${cleanMaterialText}
=== END TARGET SECTION ===`;
    }

    const isSparseInputForModelSelect = files.length === 0 && cleanMaterialText.length < 200;
    // Use gpt-4o-mini: 94% cheaper, faster, and perfectly parses structured JSON with our pre-isolated section
    const modelOverride = 'gpt-4o-mini';
    
    // Check local textbook database for matches across both sparse inputs and full syllabus inputs
    let matchedTextbooks: any[] = [];
    try {
      const dbPath = path.join(process.cwd(), 'src', 'lib', 'textbooks.json');
      if (fs.existsSync(dbPath)) {
        const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        // 1. Direct brand/title keyword match (e.g. "polaris", "pulsar", "nova", "chemie overal", "getal & ruimte", "biologie voor jou")
        const knownBrands = ['polaris', 'pulsar', 'nova', 'chemie overal', 'getal & ruimte', 'getal en ruimte', 'moderne wiskunde', 'biologie voor jou', 'systematische natuurkunde', 'overal natuurkunde', 'binas', 'campbell'];
        
        // Prioritize explicit student textbook first, then isolated section, then specialInstructions, then full text
        let foundBrand: string | undefined = undefined;
        if (resolvedTextbook) {
          foundBrand = knownBrands.find(b => resolvedTextbook.toLowerCase().includes(b));
        }
        if (!foundBrand && hasDistinctSection) {
          foundBrand = knownBrands.find(b => isolatedSection.toLowerCase().includes(b));
        }
        if (!foundBrand && specialInstructions) {
          foundBrand = knownBrands.find(b => specialInstructions.toLowerCase().includes(b));
        }
        if (!foundBrand) {
          foundBrand = knownBrands.find(b => cleanMaterialText.toLowerCase().includes(b));
        }

        if (foundBrand) {
          const searchBrand = foundBrand.includes('getal') ? 'getal' : foundBrand;
          let books = textbooks.filter((book: any) => 
            book.title.toLowerCase().includes(searchBrand)
          );
          
          // Subject-specific disambiguation (e.g. Wiskunde A vs Wiskunde B)
          const contextForSubject = `${subjectName} ${specialInstructions || ''} ${resolvedTextbook || ''}`.toLowerCase();
          if (contextForSubject.includes('wis')) {
            if (contextForSubject.includes('a') || (!contextForSubject.includes('b') && !contextForSubject.includes('c'))) {
              const wisA = books.filter((b: any) => b.title.toLowerCase().includes('wiskunde a'));
              if (wisA.length > 0) books = wisA;
            } else if (contextForSubject.includes('b')) {
              const wisB = books.filter((b: any) => b.title.toLowerCase().includes('wiskunde b'));
              if (wisB.length > 0) books = wisB;
            }
          } else {
            const subjMatches = books.filter((b: any) => 
              contextForSubject.includes(b.subject.toLowerCase()) || b.subject.toLowerCase().includes(contextForSubject)
            );
            if (subjMatches.length > 0) books = subjMatches;
          }

          matchedTextbooks = books;
        } else if (isSparseInputForModelSelect) {
          // 2. Fuzzy search for sparse queries
          const cleanSearchTitle = cleanMaterialText.toLowerCase().replace(/[.,:;()]/g, '');
          const searchTerms = cleanSearchTitle.split(/\s+/).filter(Boolean);
          let bestMatch = null;
          let bestScore = 0;
          
          for (const book of textbooks) {
            const bookWords = `${book.title} ${book.track} ${book.subject}`.toLowerCase().split(/\s+/).filter(Boolean);
            let score = 0;
            for (const term of searchTerms) {
               if (bookWords.some((bw: string) => {
                 if (bw === term) return true;
                 if (bw.length >= 3 && term.length >= 3 && (bw.startsWith(term) || term.startsWith(bw))) return true;
                 if (bw.length >= 4 && term.length >= 4) {
                   const distance = levenshteinDistance(bw, term);
                   if (bw.length >= 7 && distance <= 2) return true;
                   if (distance <= 1) return true;
                 }
                 return false;
               })) {
                 score++;
               }
            }
            
            const coreTitleWords = book.title.toLowerCase().split(/\s+/).filter((w: string) => !w.match(/^[0-9]+e$/) && w !== 'editie');
            const hasCoreTitle = coreTitleWords.every((w: string) => {
               return searchTerms.some((term) => {
                 if (w === term) return true;
                 if (w.length >= 3 && term.length >= 3 && (w.startsWith(term) || term.startsWith(w))) return true;
                 if (w.length >= 4 && term.length >= 4) {
                   const distance = levenshteinDistance(w, term);
                   if (w.length >= 7 && distance <= 2) return true;
                   if (distance <= 1) return true;
                 }
                 return false;
               });
            });
            if (hasCoreTitle) score += 5; 
            
            if (score > bestScore && score >= 2) {
              bestScore = score;
              bestMatch = book;
            }
          }
          
          if (bestMatch) {
             const coreMatchTitle = bestMatch.title.toLowerCase().split(/\s+/).filter((w: string) => !w.match(/^[0-9]+e$/) && w !== 'editie').join(' ');
             matchedTextbooks = textbooks.filter((b: any) => {
               const bCore = b.title.toLowerCase().split(/\s+/).filter((w: string) => !w.match(/^[0-9]+e$/) && w !== 'editie').join(' ');
               return bCore === coreMatchTitle;
             });
          }
        }
      }
    } catch (err) {
      console.error('[analyze-material] Error reading textbooks.json', err);
    }
    
    const isPtaOrMultiExam = /(?:pta|programma\s*van\s*toetsing|toetscode|schoolexamen|periode\s*\d|se\s*\d|tw\s*\d|stofomschrijving|toetsstof)/i.test(`${cleanMaterialText} ${specialInstructions || ''}`);

    if (matchedTextbooks.length > 0) {
      console.log(`[analyze-material] Authentic textbook match found in database: ${matchedTextbooks[0].title}`);

      // Filter by student track/grade if available
      const userTrack = `${userProfile?.academicTier || ''} ${userProfile?.grade || userProfile?.gradeLabel || ''}`.toLowerCase();
      let relevantBooks = matchedTextbooks;
      if (userTrack.includes('vwo') || userTrack.includes('havo')) {
        const tier = userTrack.includes('vwo') ? 'vwo' : 'havo';
        const tierBooks = matchedTextbooks.filter((b: any) => b.track?.toLowerCase().includes(tier));
        if (tierBooks.length > 0) relevantBooks = tierBooks;
      }

      if (isPtaOrMultiExam) {
        const refChapters = relevantBooks.map((b: any) => `--- ${b.track} ---\n${b.chapters.join('\n')}`).join('\n\n');
        promptTextForAi = `Subject: ${subjectName}

--- STUDENT'S OFFICIAL PTA / SCHOOL EXAM SYLLABUS (PRIMARY SOURCE OF TRUTH) ---
${promptTextForAi}
--- END STUDENT PTA ---

${refChapters.trim().length > 0 ? `REFERENCE TEXTBOOK INDEX FOR "${matchedTextbooks[0].title}" (Optional Lookup Only):
${refChapters}

CRITICAL PTA DIRECTIVES:
1. The student's uploaded PTA table above is the ABSOLUTE PRIMARY AUTHORITY for what is on the exam.
2. If the student specified an exam (e.g. "${specialInstructions || ''}"), find the EXACT exam row in the PTA table matching that instruction (matching grade year 6-VWO, month November, exam code WIA6VT5_26, or Schoolexamen).
3. Extract ONLY the chapters and material specified in the "Stof / Inhoud / Hoofdstukken / Omschrijving / Leerstof" cell for THAT specific exam.
4. STRICT PROHIBITION: DO NOT include chapters from any other period or exam in the PTA!
5. Output EVERY chapter explicitly stated in that row formatted with the chapter FIRST: "H[Number]: [Title]. ${cleanBookTitle(matchedTextbooks[0].title)}" or "H[Number]: [Title]" (e.g. "H1: Getallen en variabelen. Getal en Ruimte"). NEVER start with the long textbook name!
6. DO NOT combine them into 2 or 3 generic domains! If the exam specifies 6 chapters (e.g. H 1, 3, 5, 8, 10, 12), output all 6 distinct chapters individually so the student knows which chapters to study.` : ''}`;
      } else {
        const allChapters = relevantBooks.map((b: any) => `--- ${b.track} ---\n${b.chapters.join('\n')}`).join('\n\n');
        promptTextForAi = `Subject: ${subjectName}\nMaterial / Syllabus Provided by Student:\n${promptTextForAi}\n\nAuthentic Textbook Contents Found in Database for "${matchedTextbooks[0].title}":\n${allChapters}\n\nCRITICAL INSTRUCTION: When the student or syllabus specifies particular chapters, numbers, or modules, you MUST use the exact corresponding chapter titles from the textbook above.
Every chapter title MUST start with the chapter number and topic title, followed by the textbook name (e.g. "H[Number]: [Topic Title]. ${cleanBookTitle(matchedTextbooks[0].title)}") so the student can immediately see what chapter to study on their screen without it getting truncated!
Do NOT collapse them into generic domain names. Map the syllabus learning objectives to their corresponding textbook chapters.

PROGRESSIVE WEIGHTING FOR EXAMS WITH MANY CHAPTERS (5+ CHAPTERS):
- Check if the student explicitly specified which chapters/topics are more or less important. If specified, strictly obey their priority instructions.
- If not specified by the student: On an exam with many chapters (5+ chapters), the first few chapters (e.g. H1 and H3) are usually foundational prior knowledge. You can combine early closely-related foundational chapters or give them lower study hours (0.5h-1.0h), and give significantly more study time, attention, and higher difficulty (1.5h-2.5h each) to later, more complex chapters. Use the depth, number, and complexity of corresponding leerdoelen to determine the weight of this shift.`;
      }
    } else if (isSparseInputForModelSelect) {
      const words = cleanMaterialText.trim().split(/\s+/).filter(Boolean);
      const looksLikeTopicsOrObjectives = 
        cleanMaterialText.includes('\n') || 
        /^\s*\d+[\s:.-]/m.test(cleanMaterialText) || 
        /(?:chapter|hoofdstuk|thema|domein|paragraaf|les|unit|module|kandidaat|opgave|toets|exam|topic|concept)/i.test(cleanMaterialText) ||
        words.length >= 10;

      if (!looksLikeTopicsOrObjectives) {
        console.log(`[analyze-material] No match found in database for textbook title. Returning error to avoid hallucination.`);
        return NextResponse.json(
          { error: `We don't have "${cleanMaterialText}" in our textbook database yet. Please copy-paste your exact chapter list or upload a syllabus instead.` },
          { status: 400 }
        );
      }
    }

    // Build the AI prompt now that promptTextForAi has been enriched
    const userMessage = buildMaterialAnalysisMessage(
      promptTextForAi,
      subjectName,
      examDate,
      specialInstructions || undefined,
      userProfile,
      resolvedTextbook || undefined
    );

    // Call AI for structured analysis
    const analysis = await generateStructuredOutput(
      MATERIAL_ANALYSIS_PROMPT,
      userMessage,
      StudyMaterialSchema,
      'study_material_analysis',
      modelOverride
    );

    console.log(`[analyze-material] AI returned ${analysis.chapters.length} chapters, ${analysis.totalEstimatedHours}h total`);

    if (!analysis.chapters || analysis.chapters.length === 0) {
      const detectedLang = resolveStudyLanguage(userProfile, [subjectName, promptTextForAi]);
      const isDutch = detectedLang === 'nl';
      analysis.chapters = [
        {
          chapter: isDutch ? `${subjectName || 'Vak'} Kernbegrippen & Basis` : `${subjectName || 'Course'} Overview & Foundations`,
          difficulty: 3,
          confidence: 3,
          user_estimated_total_hours: 2,
          formulas: []
        },
        {
          chapter: isDutch ? `${subjectName || 'Vak'} Oefenopgaven & Examentraining` : `${subjectName || 'Course'} Core Practice & Review`,
          difficulty: 3,
          confidence: 3,
          user_estimated_total_hours: 2,
          formulas: []
        }
      ];
    }

    // 1. Sanitize chapter names to remove question prefixes or accidental story artifacts
    analysis.chapters = analysis.chapters.map((ch: any) => ({
      ...ch,
      chapter: cleanChapterName(ch.chapter || `${subjectName || 'Course'} Topic`),
    }));

    // 2. Merge identical or duplicate chapters (e.g. if two chapters ended up with the same domain)
    const mergedChapters: typeof analysis.chapters = [];
    for (const ch of analysis.chapters) {
      const existing = mergedChapters.find(
        (m: any) => m.chapter.toLowerCase() === ch.chapter.toLowerCase()
      );
      if (existing) {
        existing.user_estimated_total_hours = (existing.user_estimated_total_hours || 0) + (ch.user_estimated_total_hours || 0);
        existing.formulas = Array.from(new Set([...(existing.formulas || []), ...(ch.formulas || [])]));
        existing.difficulty = Math.max(existing.difficulty || 3, ch.difficulty || 3);
      } else {
        mergedChapters.push({ ...ch });
      }
    }
    analysis.chapters = mergedChapters;

    // 2b. Voorkennis combining for large multi-chapter exams (5+ or 6 chapters):
    // In Dutch secondary school (HAVO / VWO / VMBO), each chapter has ~5 paragraphs (§1 t/m §5).
    // An exam with 6 chapters has ~30 paragraphs! The first 2 (or 3) foundational chapters are
    // "voorkennis" (prior knowledge) — combine them into 1 review topic with lighter hours (1.0h–1.5h).
    const detectedLang = resolveStudyLanguage(userProfile, [subjectName, promptTextForAi]);
    const isDutch = detectedLang === 'nl';
    analysis.chapters = combineVoorkennisChapters(analysis.chapters, isDutch);

    // 2c. Always include a dedicated Revision & Practice session for the day before the exam
    const hasRevision = analysis.chapters.some((ch: any) => 
      new RegExp('\\b(herhaling|proeftoets|eindtoets|revision|review|practice\\s*exam)\\b', 'i').test(ch.chapter)
    );
    if (!hasRevision && analysis.chapters.length > 0) {
      const revisionTitle = isDutch ? 'Herhaling & Proeftoets (dag vóór de toets)' : 'Revision & Practice Exam (day before exam)';
      analysis.chapters.push({
        chapter: revisionTitle,
        user_estimated_total_hours: 1.0,
        difficulty: 3,
        confidence: 3,
        formulas: [],
      });
    }

    // 3. Realistic Hour Normalization:
    // Students (even in 6 VWO) preparing for an exam should receive a realistic, manageable recommendation (typically 6-9 hours).
    // An estimate of 20-30 hours (like 24h) is overwhelmingly high and impractical.
    // Unless the user explicitly requested a large number of hours in specialInstructions,
    // normalize total study hours so they do not exceed realistic bounds (max 9-10h for an exam).
    const rawSum = analysis.chapters.reduce((sum: number, ch: any) => sum + (ch.user_estimated_total_hours || 1), 0);
    const userRequestedHighHours = specialInstructions && /\b(?:[1-9]\d{1,2})\s*(?:uur|uren|hours|hrs)\b/i.test(specialInstructions);

    if (!userRequestedHighHours && rawSum > 10) {
      // Scale down proportionally towards a target of ~8.0 hours
      const targetBudget = 8.0;
      const ratio = targetBudget / rawSum;
      let scaledSum = 0;
      analysis.chapters = analysis.chapters.map((ch: any) => {
        const rounded = Math.max(0.5, Math.round((ch.user_estimated_total_hours * ratio) * 2) / 2);
        scaledSum += rounded;
        return {
          ...ch,
          user_estimated_total_hours: rounded,
        };
      });
      analysis.totalEstimatedHours = scaledSum;
    } else {
      let chaptersSum = 0;
      analysis.chapters = analysis.chapters.map((ch: any) => {
        const rounded = Math.max(0.5, Math.round((ch.user_estimated_total_hours || 1) * 2) / 2);
        chaptersSum += rounded;
        return {
          ...ch,
          user_estimated_total_hours: rounded,
        };
      });
      analysis.totalEstimatedHours = chaptersSum;
    }

    return NextResponse.json({
      success: true,
      analysis,
      textbookUsed: resolvedTextbook || null,
      extractedFileText: rawDocumentText,
      rawText: cleanMaterialText,
      fileInfo: {
        name: files.length > 0 ? parsedFileInfo.names.join(', ') : (clientFileNames || 'Typed Input'),
        type: parsedFileInfo.type,
        pageCount: parsedFileInfo.pageCount,
        textLength: parsedFileInfo.textLength,
      },
    });

  } catch (error: any) {
    console.error('[analyze-material] Error:', error);
    
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'AI API key not configured. Please add OPENAI_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze material' },
      { status: 500 }
    );
  }
}

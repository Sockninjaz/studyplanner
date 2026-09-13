import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { parseDocument } from '@/lib/ai/fileParsers';
import { MATERIAL_ANALYSIS_PROMPT, buildMaterialAnalysisMessage } from '@/lib/ai/prompts';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import googleSearch from 'googlethis';
import fs from 'fs';
import path from 'path';

// Zod schema for the AI's structured response
const StudyMaterialSchema = z.object({
  chapters: z.array(z.object({
    chapter: z.string().describe('The core academic concept/theory being tested (e.g. "Quantum Mechanics", "Electromagnetism"). MUST NOT be the specific story context or application of the test question.'),
    difficulty: z.number().min(1).max(5).describe('Difficulty level 1-5'),
    confidence: z.number().min(1).max(5).describe('Expected student confidence 1-5'),
    user_estimated_total_hours: z.number().min(0.25).max(100).describe('Study hours for this chapter — can be fractional (e.g. 0.5), all chapters must sum to totalEstimatedHours'),
    formulas: z.array(z.string()).describe('Key formulas, equations, or scientific laws explicitly mentioned in the material for this chapter. Return an empty array if none.'),
  })),
  summary: z.string().describe('Brief summary of the overall material'),
  isSuggestedFallback: z.boolean().describe('True if the user provided sparse input and you are generating high-level national curriculum milestones instead of concrete text extraction. False if the provided text was rich and sufficient.'),
  totalEstimatedHours: z.number().min(0.25).max(100).describe('TOTAL realistic study hours for the whole document (conservative estimate)'),
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const rawText = formData.get('rawText') as string | null;
    const subjectName = formData.get('subjectName') as string || 'Unknown Subject';
    const examDate = formData.get('examDate') as string || 'TBD';
    const specialInstructions = formData.get('specialInstructions') as string | null;

    // Fetch user profile to guide pacing and syllabus auto-fetching
    const session = await getServerSession();
    let userProfile = undefined;
    if (session?.user?.email) {
      await dbConnect();
      const user = await User.findOne({ email: session.user.email }).lean();
      if (user?.onboardingProfile) {
        userProfile = user.onboardingProfile;
      }
    }

    if (files.length === 0 && (!rawText || rawText.trim().length === 0)) {
      return NextResponse.json({ error: 'Please upload at least one file or type your material.' }, { status: 400 });
    }

    let textToAnalyze = '';
    let parsedFileInfo = {
      type: 'mixed',
      pageCount: 0,
      textLength: 0,
      names: [] as string[]
    };

    if (files.length > 0) {
      console.log(`[analyze-material] Parsing ${files.length} files`);
      
      for (const file of files) {
        console.log(`[analyze-material] Parsing ${file.name} (${file.type}, ${file.size} bytes)`);
        
        const buffer = Buffer.from(await file.arrayBuffer());
        let fileName = file.name;
        if (!fileName.includes('.')) {
          if (file.type === 'application/pdf' || (buffer.length > 4 && buffer.slice(0, 4).toString('ascii') === '%PDF')) {
            fileName += '.pdf';
          } else {
            fileName += '.txt';
          }
        }
        
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
        
        // Multimodal Vision OCR for images/screenshots or scanned PDFs with sparse text
        if (isImage || (isPdf && parsed.text.trim().length < 50)) {
          console.log(`[analyze-material] Running Multimodal Vision OCR for ${fileName} (${resolvedMime})...`);
          try {
            const { extractTextFromMultimodal } = await import('@/lib/ai/aiClient');
            const ocrText = await extractTextFromMultimodal(buffer, resolvedMime, specialInstructions || undefined);
            if (ocrText && ocrText.trim().length > 0) {
              console.log(`[analyze-material] Vision OCR successful for ${fileName} (${ocrText.length} chars).`);
              textToAnalyze += `\n\n--- Extracted Material from ${fileName} ---\n${ocrText}`;
            }
          } catch (ocrErr: any) {
            console.error(`[analyze-material] Vision OCR failed for ${fileName}:`, ocrErr);
          }
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

    // We will build the userMessage after potentially enriching textToAnalyze.

    // If input is sparse (no file, text < 200 chars), we give the AI the ability to search the web to find the TOC.
    const isSparseInputForModelSelect = files.length === 0 && textToAnalyze.trim().length < 200;
    // Always use gpt-4o for analysis to ensure it perfectly respects strict negative rules and schema constraints.
    const modelOverride = 'gpt-4o';
    
    if (isSparseInputForModelSelect) {
      console.log(`[analyze-material] Sparse input detected. Checking local textbook database...`);
      
      let matchedTextbooks = [];
      try {
        const dbPath = path.join(process.cwd(), 'src', 'lib', 'textbooks.json');
        if (fs.existsSync(dbPath)) {
          const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          
          const searchTitle = textToAnalyze.toLowerCase();
          
          // Strip punctuation so "a," becomes "a" and "book:" becomes "book"
          const cleanSearchTitle = searchTitle.replace(/[.,:;()]/g, '');
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
                 
                 // Levenshtein fuzzy matching for typos
                 if (bw.length >= 4 && term.length >= 4) {
                   const distance = levenshteinDistance(bw, term);
                   if (bw.length >= 7 && distance <= 2) return true; // Tolerate 2 typos for long words
                   if (distance <= 1) return true; // Tolerate 1 typo for medium words
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
             
             // Try to narrow down to specific track if the user provided it
             const exactTrackMatches = matchedTextbooks.filter((b: any) => {
                const trackWords = b.track.toLowerCase().split(/\s+/).filter(Boolean);
                return trackWords.every((w: string) => searchTerms.includes(w));
             });
             
             // Reverted track filtering as per user request
             // if (exactTrackMatches.length > 0) {
             //    matchedTextbooks = exactTrackMatches;
             // }
          } else {
             matchedTextbooks = [];
          }
        }
      } catch (err) {
        console.error('[analyze-material] Error reading textbooks.json', err);
      }
      
      if (matchedTextbooks.length > 0) {
        console.log(`[analyze-material] Exact match found in local database for title: ${matchedTextbooks[0].title}`);
        const allChapters = matchedTextbooks.map((b: any) => `--- ${b.track} ---\n${b.chapters.join('\n')}`).join('\n\n');
        
        // Add a strict instruction to ONLY use these chapters
        textToAnalyze = `Subject: ${subjectName}\nMaterial: ${textToAnalyze}\n\nAuthentic Textbook Contents Found in Database:\n${allChapters}\n\nCRITICAL INSTRUCTION: You MUST use the exact word-for-word chapter titles from the database above that match the user's requested chapters. Do NOT invent, translate, or rephrase any chapters. Do NOT mix them with international curriculum standards. If the user asks for H1 to H12, pick H1 to H12 exactly as they are named above in the provided authentic contents. IMPORTANT PARSING RULE: If the user provides a sparse list of numbers separated by spaces or commas (e.g., "11 10 9 4" or "h11, 10, 9"), you MUST treat EVERY INDIVIDUAL NUMBER as a distinct, separate chapter request (e.g., Chapter 11, Chapter 10, Chapter 9, Chapter 4) and extract ALL of them from the database. Do not skip any numbers.`;
      } else {
        console.log(`[analyze-material] No match found in database. Returning error to avoid hallucination.`);
        return NextResponse.json(
          { error: `We don't have "${textToAnalyze}" in our textbook database yet. Please copy-paste your exact chapter list or upload a syllabus instead.` },
          { status: 400 }
        );
      }
    }

    // Build the AI prompt now that textToAnalyze might have been enriched
    const userMessage = buildMaterialAnalysisMessage(textToAnalyze, subjectName, examDate, specialInstructions || undefined, userProfile);

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
      analysis.chapters = [
        {
          chapter: `${subjectName || 'Course'} Overview & Foundations`,
          difficulty: 3,
          confidence: 3,
          user_estimated_total_hours: 2,
          formulas: []
        },
        {
          chapter: `${subjectName || 'Course'} Core Practice & Review`,
          difficulty: 3,
          confidence: 3,
          user_estimated_total_hours: 2,
          formulas: []
        }
      ];
    }

    // Guarantee clean 0.5-hour step rounding for all chapter hours and total
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

    return NextResponse.json({
      success: true,
      analysis,
      rawText: textToAnalyze,
      fileInfo: {
        name: files.length > 0 ? parsedFileInfo.names.join(', ') : 'Typed Input',
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

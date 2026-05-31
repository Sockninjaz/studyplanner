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
    chapter: z.string().describe('Topic/chapter name'),
    difficulty: z.number().min(1).max(5).describe('Difficulty level 1-5'),
    confidence: z.number().min(1).max(5).describe('Expected student confidence 1-5'),
    user_estimated_total_hours: z.number().min(0.25).max(100).describe('Study hours for this chapter — can be fractional (e.g. 0.5), all chapters must sum to totalEstimatedHours'),
  })),
  summary: z.string().describe('Brief summary of the overall material'),
  isSuggestedFallback: z.boolean().describe('True if the user provided sparse input and you are generating high-level national curriculum milestones instead of concrete text extraction. False if the provided text was rich and sufficient.'),
  totalEstimatedHours: z.number().min(0.25).max(100).describe('TOTAL realistic study hours for the whole document (conservative estimate)'),
});

export type MaterialAnalysisResult = z.infer<typeof StudyMaterialSchema>;

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
        
        const parsed = await parseDocument(buffer, fileName);
        console.log(`[analyze-material] Extracted ${parsed.text.length} chars from ${file.name}`);
        
        textToAnalyze += `\n\n--- Document: ${fileName} ---\n\n${parsed.text}`;
        parsedFileInfo.pageCount += (parsed.pageCount ?? 0);
        parsedFileInfo.names.push(fileName);
        
        // Basic OCR fallback if text is too short for a PDF
        if (parsed.text.trim().length < 50 && file.type === 'application/pdf') {
          console.log(`[analyze-material] PDF text extraction yielded almost nothing for ${file.name}. Attempting Gemini Multimodal OCR...`);
          try {
            const { extractTextFromMultimodal } = await import('@/lib/ai/aiClient');
            const ocrText = await extractTextFromMultimodal(buffer, 'application/pdf', specialInstructions || undefined);
            if (ocrText && ocrText.trim().length >= 50) {
              console.log(`[analyze-material] Gemini OCR successful for ${file.name}.`);
              textToAnalyze += `\n[OCR Extracted Text for ${fileName}]:\n${ocrText}`;
            }
          } catch (ocrErr: any) {
            console.error(`[analyze-material] Gemini OCR failed for ${file.name}:`, ocrErr);
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

    if (files.length === 0 && textToAnalyze.trim().length < 3) {
      return NextResponse.json(
        { error: 'Input is too short. Please provide at least a topic or chapter description.' },
        { status: 400 }
      );
    }

    // We will build the userMessage after potentially enriching textToAnalyze.

    // If input is sparse (no file, text < 200 chars), we give the AI the ability to search the web to find the TOC.
    const isSparseInputForModelSelect = files.length === 0 && textToAnalyze.trim().length < 200;
    const modelOverride = isSparseInputForModelSelect ? 'gpt-4o' : undefined;
    
    if (isSparseInputForModelSelect) {
      console.log(`[analyze-material] Sparse input detected. Checking local textbook database...`);
      
      let matchedTextbooks = [];
      try {
        const dbPath = path.join(process.cwd(), 'src', 'lib', 'textbooks.json');
        if (fs.existsSync(dbPath)) {
          const textbooks = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          
          const searchTitle = textToAnalyze.toLowerCase();
          
          matchedTextbooks = textbooks.filter((book: any) => {
            return searchTitle.includes(book.title.toLowerCase());
          });
        }
      } catch (err) {
        console.error('[analyze-material] Error reading textbooks.json', err);
      }
      
      if (matchedTextbooks.length > 0) {
        console.log(`[analyze-material] Exact match found in local database for title: ${matchedTextbooks[0].title}`);
        const allChapters = matchedTextbooks.map((b: any) => `--- ${b.track} ---\n${b.chapters.join('\n')}`).join('\n\n');
        
        // Add a strict instruction to ONLY use these chapters
        textToAnalyze = `Subject: ${subjectName}\nMaterial: ${textToAnalyze}\n\nAuthentic Textbook Contents Found in Database:\n${allChapters}\n\nCRITICAL INSTRUCTION: You MUST use the exact chapter titles from the database above that match the user's requested chapters. Do NOT invent generic chemistry chapters. If the user asks for H1 to H12, pick H1 to H12 exactly as they are named above.`;
      } else {
        console.log(`[analyze-material] No match found in database. Relying on AI's vast internal knowledge...`);
        let profileContext = '';
        if (userProfile) {
          const parts = [];
          if (userProfile.countryName) parts.push(`Country: ${userProfile.countryName}`);
          if (userProfile.academicTierLabel) parts.push(`Track/Tier: ${userProfile.academicTierLabel}`);
          if (userProfile.gradeLabel) parts.push(`Grade/Year: ${userProfile.gradeLabel}`);
          if (userProfile.examBoardLabel) parts.push(`Exam Board: ${userProfile.examBoardLabel}`);
          if (parts.length > 0) {
            profileContext = `The user is in:\n${parts.join(' | ')}\n\nCRITICAL: Use this information (especially Grade and Track) to find the EXACT correct edition of the book. For example, if the user is in VWO 5, find the VWO 5 edition.\n\n`;
          }
        }

        const prompt = `You are an expert study planner assistant with vast knowledge of all major international textbooks.
        A user has given you a brief textbook title or study material description: "${textToAnalyze}" for the subject "${subjectName}".
        ${profileContext}
        Your goal is to output the EXACT authentic Table of Contents for this specific book and edition from your internal knowledge so it can be used for accurate study planning.
        Provide a highly detailed chapter list.`;

        const aiResponse = await generateText({
          model: openai(modelOverride || 'gpt-4o'),
          messages: [{ role: 'user', content: prompt }]
        });
        
        // Update textToAnalyze to the AI's authentic textbook output
        textToAnalyze = `Subject: ${subjectName}\nMaterial: ${textToAnalyze}\n\nAuthentic Textbook Contents Found by AI:\n${aiResponse.text}`;
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

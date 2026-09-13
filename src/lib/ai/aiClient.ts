import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Use GPT-4o-mini — fast, cheap, and superb at structured JSON output
const model = openai('gpt-4o-mini');
const geminiModel = google('models/gemini-1.5-flash-latest');

/**
 * Call Gemini with a system prompt and user message, expecting structured JSON output.
 * Uses Zod schema validation to guarantee the response shape.
 */
export async function generateStructuredOutput<T>(
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodSchema<T>,
  schemaName: string = 'result',
  overrideModelName?: string
): Promise<T> {
  const selectedModel = overrideModelName ? openai(overrideModelName) : model;

  const result = await generateObject({
    model: selectedModel,
    schema,
    schemaName,
    system: systemPrompt,
    prompt: userMessage,
    temperature: 0.1,
  });

  return result.object;
}

import { generateText } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Specifically for multimodal tasks like OCR on screenshots, images, and scanned PDFs.
 * Uses OpenAI GPT-4o-mini Vision as primary for images, with Gemini fallback.
 */
export async function extractTextFromMultimodal(
  fileBuffer: Buffer,
  mimeType: string,
  specialInstructions?: string
): Promise<string> {
  const normalizedMime = mimeType?.toLowerCase() || 'image/png';
  const isImage = normalizedMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'gif'].some(ext => normalizedMime.includes(ext));

  const prompt = `You are an expert OCR and educational content analyzer.
Thoroughly examine this screenshot, document, or photo and extract all educational study material, syllabus topics, chapter titles, homework assignments, formulas, sub-topics, page ranges, and learning objectives visible.

RULES FOR ACCURATE EXTRACTION:
1. SCREENSHOTS & APPS: If the image is a screenshot of a school portal, learning app, or digital platform (e.g. Magister, Somtoday, Canvas, Blackboard, Teams, Google Classroom, ELO, textbook viewer), ignore peripheral UI buttons and navigation bars, and extract all academic chapters, assignments, and test topics listed.
2. VERBATIM TITLES: If the image lists specific chapter titles, numbers, or themes (e.g. "Hoofdstuk 4: Zuren en Basen", "Thema 3", "Unit 2: Kinematics", "Paragraaf 3.1 t/m 3.4"), EXTRACT THOSE TITLES EXACTLY VERBATIM in their original language.
3. CONCEPTS & FORMULAS: Include key definitions, formulas, or bullet points mentioned under each topic so an actionable study plan can be generated.
${specialInstructions ? `\nUSER SPECIAL INSTRUCTIONS (focus on these): ${specialInstructions}` : ''}`;

  if (isImage) {
    // Direct OpenAI Vision inference (fast, reliable, handles screenshots & all image formats)
    console.log(`[aiClient] Performing OpenAI Vision OCR for screenshot/image (${normalizedMime})...`);
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: fileBuffer }
          ]
        }
      ]
    });
    return result.text;
  }

  // For PDFs: Try Google Generative AI first if available, otherwise fallback to OpenAI
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (googleApiKey) {
    try {
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const fileManager = new GoogleAIFileManager(googleApiKey);
      const gemini = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
      });

      const ext = normalizedMime.split('/')[1] || 'pdf';
      const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.${ext}`);
      await fs.writeFile(tempFilePath, fileBuffer);

      try {
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
          mimeType: normalizedMime,
          displayName: "Document OCR",
        });

        let fileState = await fileManager.getFile(uploadResult.file.name);
        let retries = 0;
        while (fileState.state === 'PROCESSING' && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          fileState = await fileManager.getFile(uploadResult.file.name);
          retries++;
        }

        if (fileState.state === 'ACTIVE') {
          const result = await gemini.generateContent([
            prompt, 
            {
              fileData: {
                fileUri: uploadResult.file.uri,
                mimeType: uploadResult.file.mimeType,
              },
            }
          ]);
          await fileManager.deleteFile(uploadResult.file.name).catch(() => {});
          return result.response.text();
        }
      } finally {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    } catch (googleErr) {
      console.warn('[aiClient] Google Multimodal OCR failed, falling back to OpenAI Vision...', googleErr);
    }
  }

  // Fallback: Use OpenAI vision
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: fileBuffer }
        ]
      }
    ]
  });
  return result.text;
}

export { model, geminiModel };

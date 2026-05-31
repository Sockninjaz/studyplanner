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
  });

  return result.object;
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Specifically for multimodal tasks like OCR on scanned PDFs.
 * Bypasses Vercel AI SDK validation bugs by using the official Google SDK directly.
 * Only extracts text; does not attempt to force large transcriptions into JSON.
 */
export async function extractTextFromMultimodal(
  fileBuffer: Buffer,
  mimeType: string,
  specialInstructions?: string
): Promise<string> {
  // 1. Initialize Google SDK natively
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);
  const gemini = genAI.getGenerativeModel({ 
    model: "gemini-pro-latest",
  });

  // 2. Write buffer to a temporary file because File API requires a path
  const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.pdf`);
  await fs.writeFile(tempFilePath, fileBuffer);

  let rawTextOutput = '';
  
  try {
    // 3. Upload to Gemini File API
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType,
      displayName: "Scanned Document",
    });

    console.log(`[aiClient] Uploaded to Gemini: ${uploadResult.file.name}. Waiting for processing...`);

    // PDFs require asynchronous processing on Google's side. We MUST poll until active.
    let fileState = await fileManager.getFile(uploadResult.file.name);
    while (fileState.state === 'PROCESSING') {
      console.log(`[aiClient] File is PROCESSING. Waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      fileState = await fileManager.getFile(uploadResult.file.name);
    }

    if (fileState.state === 'FAILED') {
      throw new Error("Gemini failed to process the uploaded file.");
    }

    console.log(`[aiClient] File is ${fileState.state}. Starting inference...`);

    const filePart = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };

    // 4. Perform native multimodal generation using the File URI
    const prompt = `Extract a comprehensive, highly detailed outline of all the educational content, chapters, sub-chapters, and topics in this document. 
    
    CRITICAL INSTRUCTION: Do NOT transcribe or quote verbatim text. You MUST heavily paraphrase and summarize the key concepts to completely avoid copyright recitation filters. 
    
    Include enough detail so another AI can accurately estimate how many study hours this material requires.
    ${specialInstructions ? `\nUSER INSTRUCTIONS (focus on these): ${specialInstructions}` : ''}`;

    const result = await gemini.generateContent([
      prompt, 
      filePart
    ]);
    rawTextOutput = result.response.text();
    
    // Cleanup the file from Google's servers (optional but good practice)
    await fileManager.deleteFile(uploadResult.file.name).catch(() => {});
  } finally {
    // Always cleanup local temp file
    await fs.unlink(tempFilePath).catch(() => {});
  }

  return rawTextOutput;
}

export { model, geminiModel };

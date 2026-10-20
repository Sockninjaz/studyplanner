import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitAsync, getClientIp, AI_RATE_LIMIT_PRESET } from '@/lib/rate-limit';
import { validateUploadFile, MAX_UPLOAD_SIZE_BYTES } from '@/lib/ai/fileValidation';
import { executeAiWithLedger } from '@/lib/ai/aiLedger';
import { extractTextFromMultimodal } from '@/lib/ai/aiClient';
import { parseDocument } from '@/lib/ai/fileParsers';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SyllabusSchema = z.object({
  chapters: z.array(z.object({
    chapter: z.string().describe('Chapter or topic title (e.g. "Hoofdstuk 3: Krachten", "Thema 2: Cellen")'),
    difficulty: z.number().min(1).max(5).default(3).describe('Difficulty 1-5'),
    confidence: z.number().min(1).max(5).default(3).describe('Confidence 1-5'),
    user_estimated_total_hours: z.number().min(0.5).max(40).default(2).describe('Estimated study hours'),
    formulas: z.array(z.string()).default([]).describe('Formulas or key equations'),
  })),
  summary: z.string().describe('Short Dutch summary of the syllabus content'),
  totalEstimatedHours: z.number().describe('Sum of estimated hours'),
});

const SYSTEM_PROMPT = `Je bent een deskundige Nederlandse onderwijsassistent.
Analyseer het verstrekte lesmateriaal, toetsrooster of de syllabus.
Splits de leerstof logisch op in afgebakende hoofdstukken of onderwerpen met realistische studietijd in uren.
Houd je strikt aan het JSON-formaat en overschrijd nooit 1500 tokens.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1. Enforce IP Rate Limiting (max 5 requests per IP per 10 minutes)
  const rateLimitResult = await checkRateLimitAsync(ip, '/api/parse-syllabus', AI_RATE_LIMIT_PRESET);
  if (!rateLimitResult.success) {
    const retrySec = Math.ceil(rateLimitResult.resetMs / 1000);
    return NextResponse.json(
      {
        error: `Te veel verzoeken. Probeer het over ${Math.ceil(retrySec / 60)} minuten opnieuw. (Max 5 verzoeken per 10 minuten).`,
        retryAfter: retrySec,
      },
      {
        status: 429,
        headers: { 'Retry-After': retrySec.toString() },
      }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let extractedText = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('text') as string | null;

      if (!file && !rawText) {
        return NextResponse.json(
          { error: 'Geen bestand of tekst aangeleverd.' },
          { status: 400 }
        );
      }

      if (file) {
        // Enforce 4 MB payload cap
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          return NextResponse.json(
            { error: 'Bestand overschrijdt de maximale limiet van 4 MB.' },
            { status: 413 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Strict MIME & Magic Bytes Validation (PNG, JPEG, PDF)
        const validation = validateUploadFile(buffer, file.type);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error || 'Ongeldig bestand.' },
            { status: 415 }
          );
        }

        if (validation.detectedType === 'png' || validation.detectedType === 'jpeg') {
          extractedText = await extractTextFromMultimodal(buffer, validation.mimeType!);
        } else if (validation.detectedType === 'pdf') {
          try {
            const parsed = await parseDocument(buffer, file.name);
            extractedText = parsed.text;
          } catch {
            extractedText = await extractTextFromMultimodal(buffer, 'application/pdf');
          }
        }
      }

      if (rawText) {
        extractedText = `${rawText}\n\n${extractedText}`.trim();
      }
    } else {
      // JSON body
      const body = await req.json().catch(() => ({}));
      extractedText = (body.text || '').trim();
    }

    if (!extractedText || extractedText.length < 5) {
      return NextResponse.json(
        { error: 'Onvoldoende tekstinhoud kunnen detecteren in het aangeleverde materiaal.' },
        { status: 422 }
      );
    }

    // Truncate raw input string to prevent token overflow before AI inference
    const trimmedInput = extractedText.slice(0, 12000);

    // 3. Execute AI through the hard-capped ledger hook
    const parsedData = await executeAiWithLedger(
      {
        endpoint: '/api/parse-syllabus',
        clientIp: ip,
        model: 'gpt-4o-mini',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `Extraheer de hoofdstukken en studieplanning uit de volgende tekst:\n\n${trimmedInput}`,
      },
      async ({ system, prompt, maxTokens }) => {
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: SyllabusSchema,
          system,
          prompt,
          maxTokens,
          temperature: 0.1,
        } as any);
        return result.object;
      }
    );

    return NextResponse.json({
      success: true,
      data: parsedData,
      rateLimit: {
        remaining: rateLimitResult.remaining,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/parse-syllabus:', error);
    return NextResponse.json(
      { error: error.message || 'Interne serverfout bij syllabus-analyse.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitAsync, getClientIp, AI_RATE_LIMIT_PRESET } from '@/lib/rate-limit';
import { executeAiWithLedger } from '@/lib/ai/aiLedger';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const GenerateScheduleSchema = z.object({
  subject: z.string().min(1, 'Vak is verplicht'),
  examDate: z.string().min(1, 'Examendatum is verplicht'),
  chapters: z.array(z.string()).min(1, 'Minstens 1 hoofdstuk/onderwerp vereist'),
  dailyLimitHours: z.number().min(0.5).max(12).default(3),
  sessionDurationMinutes: z.number().min(15).max(120).default(30),
});

const GeneratedPlanOutputSchema = z.object({
  sessions: z.array(z.object({
    dayOffset: z.number().describe('Day offset from today (e.g. 0 for today, 1 for tomorrow)'),
    chapter: z.string(),
    tasks: z.array(z.string()).describe('1-3 concrete tasks for this session'),
    recommendedMinutes: z.number().default(30),
  })),
  studyAdvice: z.string().describe('Short actionable advice in Dutch for this specific subject'),
});

const SYSTEM_PROMPT = `Je bent een ervaren Nederlandse studieplanner en roostercoach.
Gegeven een examendatum, vak en hoofdstukken, genereer je een logische spreiding van studiesessies.
Regels:
- MAXIMAAL 1500 tokens.
- Wees beknopt, to-the-point en direct uitvoerbaar.
- Geen inleiding of beleefdheidsfrasen; lever uitsluitend de gevraagde JSON structuur op.`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1. IP Rate Limiting (max 5 requests per 10 minutes)
  const rateLimitResult = await checkRateLimitAsync(ip, '/api/generate', AI_RATE_LIMIT_PRESET);
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
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = GenerateScheduleSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoerparameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { subject, examDate, chapters, dailyLimitHours, sessionDurationMinutes } = parseResult.data;

    const userPrompt = `
Vak: ${subject}
Toetsdatum: ${examDate}
Hoofdstukken: ${chapters.join(', ')}
Beschikbare studietijd per dag: ${dailyLimitHours} uur
Sessieduur per blok: ${sessionDurationMinutes} minuten
Genereer een optimaal verdeelde studieplanning tot aan de toetsdatum.
`;

    // 2. Execute AI through the hard-capped ledger hook
    const plan = await executeAiWithLedger(
      {
        endpoint: '/api/generate',
        clientIp: ip,
        model: 'gpt-4o-mini',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      },
      async ({ system, prompt, maxTokens }) => {
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: GeneratedPlanOutputSchema,
          system,
          prompt,
          maxTokens,
          temperature: 0.2,
        } as any);
        return result.object;
      }
    );

    return NextResponse.json({
      success: true,
      data: plan,
      rateLimit: {
        remaining: rateLimitResult.remaining,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
      { error: error.message || 'Interne fout bij het genereren van de studieplanning.' },
      { status: 500 }
    );
  }
}

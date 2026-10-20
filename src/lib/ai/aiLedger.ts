export const HARD_CAPPED_MAX_TOKENS = 1500;

export interface LedgerEntry {
  id: string;
  timestamp: Date;
  endpoint: string;
  clientIp: string;
  userId?: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  model: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

// In-memory sliding ledger history (retained up to 1,000 entries)
const recentLedgerEntries: LedgerEntry[] = [];

// Circuit breaker map: caller identifier -> array of recent call timestamps
const callerCallHistory = new Map<string, number[]>();

// Maximum permitted consecutive calls within 60 seconds per caller before circuit breaker trips
const MAX_CALLS_PER_MINUTE = 8;

export class RunawayLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunawayLoopError';
  }
}

/**
 * Checks and trips circuit breaker if an automated runaway loop is detected.
 */
function verifyRunawayLoop(callerKey: string): void {
  const now = Date.now();
  const windowStart = now - 60 * 1000;

  let history = callerCallHistory.get(callerKey);
  if (!history) {
    history = [];
    callerCallHistory.set(callerKey, history);
  }

  // Filter last 60 seconds
  const recentHistory = history.filter(ts => ts > windowStart);
  recentHistory.push(now);
  callerCallHistory.set(callerKey, recentHistory);

  if (recentHistory.length > MAX_CALLS_PER_MINUTE) {
    throw new RunawayLoopError(
      `AI Circuit Breaker: Mogelijk oneindige lus gedetecteerd (${recentHistory.length} verzoeken in 60s). Verzoek geblokkeerd.`
    );
  }
}

/**
 * Enforces strict system prompt guardrails against token inflation and hallucinated loops.
 */
export function sanitizeSystemPrompt(basePrompt: string): string {
  const guardrail = `
STRICT SECURITY & SYSTEM GUARDRAILS:
1. HARD-CAP: Keep output strictly within 1500 tokens.
2. NO RUNAWAY LOOPS: Never output repetitive filler, conversational preamble, or endless lists.
3. CONCISENESS: Return only the requested educational structure in Dutch or English as indicated.
`;
  return `${guardrail.trim()}\n\n${basePrompt}`;
}

/**
 * Proxy / Ledger Hook wrapper for all AI calls.
 * Hard-caps tokens, detects loops, and records telemetry.
 */
export async function executeAiWithLedger<T>(
  options: {
    endpoint: string;
    clientIp: string;
    userId?: string;
    model?: string;
    systemPrompt: string;
    userPrompt: string;
  },
  aiFn: (params: { system: string; prompt: string; maxTokens: number }) => Promise<T>
): Promise<T> {
  const callerKey = `${options.endpoint}:${options.clientIp}`;
  verifyRunawayLoop(callerKey);

  const startTime = Date.now();
  const guardedSystem = sanitizeSystemPrompt(options.systemPrompt);
  const estimatedPromptTokens = Math.ceil((guardedSystem.length + options.userPrompt.length) / 4);

  let success = true;
  let errorMsg: string | undefined;

  try {
    const result = await aiFn({
      system: guardedSystem,
      prompt: options.userPrompt,
      maxTokens: HARD_CAPPED_MAX_TOKENS, // Enforced hard cap
    });
    return result;
  } catch (err: any) {
    success = false;
    errorMsg = err.message || 'Onbekende AI-fout';
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    const entry: LedgerEntry = {
      id: Math.random().toString(36).substring(2, 12),
      timestamp: new Date(),
      endpoint: options.endpoint,
      clientIp: options.clientIp,
      userId: options.userId,
      estimatedPromptTokens,
      estimatedCompletionTokens: Math.min(HARD_CAPPED_MAX_TOKENS, 800),
      model: options.model || 'gpt-4o-mini',
      durationMs,
      success,
      error: errorMsg,
    };

    recentLedgerEntries.push(entry);
    if (recentLedgerEntries.length > 1000) {
      recentLedgerEntries.shift();
    }

    if (process.env.NODE_ENV !== 'production' || !success) {
      console.log(`[AI Ledger] ${entry.endpoint} - IP: ${entry.clientIp} - Duration: ${durationMs}ms - Success: ${success}`);
    }
  }
}

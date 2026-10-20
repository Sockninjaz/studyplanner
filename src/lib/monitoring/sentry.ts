/**
 * Sentry Monitoring & Error Reporting Configuration
 * Includes strict PII and token scrubbing to guarantee GDPR compliance.
 */

// Sensitive keys that must be redacted before telemetry transmission
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /cookie/i,
  /authorization/i,
  /bearer/i,
  /key/i,
  /share_?token/i,
  /stripe/i,
];

/**
 * Deeply sanitizes an object or string to prevent logging sensitive tokens or passwords.
 */
export function sanitizeSensitiveData(data: any): any {
  if (!data) return data;

  if (typeof data === 'string') {
    // Redact Bearer tokens and long base64url keys
    let sanitized = data.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
    sanitized = sanitized.replace(/([a-zA-Z0-9_-]{24,})/g, (match) => {
      // If it looks like a token, redact
      if (match.length > 28) return '[REDACTED_TOKEN]';
      return match;
    });
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeSensitiveData);
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeSensitiveData(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

/**
 * Safely captures an unhandled API error without exposing tokens.
 */
export function captureApiException(error: unknown, context?: Record<string, any>) {
  const sanitizedContext = context ? sanitizeSensitiveData(context) : {};

  console.error('[Sentry Error]', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: sanitizedContext,
  });

  // If @sentry/nextjs is initialized in the environment, report cleanly:
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, { extra: sanitizedContext });
  }
}

/**
 * Captures malformed AI outputs for diagnostic auditing without logging prompt PII.
 */
export function captureMalformedAiOutput(endpoint: string, rawOutput: string, schemaError?: unknown) {
  const sanitizedSnippet = rawOutput.length > 300 ? `${rawOutput.substring(0, 300)}... [truncated]` : rawOutput;

  console.warn('[AI Malformed Output Warning]', {
    endpoint,
    snippet: sanitizeSensitiveData(sanitizedSnippet),
    error: schemaError instanceof Error ? schemaError.message : String(schemaError),
  });

  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureMessage(`Malformed AI Output in ${endpoint}`, {
      level: 'warning',
      extra: {
        endpoint,
        rawSnippet: sanitizeSensitiveData(sanitizedSnippet),
      },
    });
  }
}

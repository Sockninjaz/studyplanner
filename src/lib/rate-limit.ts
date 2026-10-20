import { NextRequest } from 'next/server';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// Preset for AI endpoints: max 5 requests per IP per 10 minutes
export const AI_RATE_LIMIT_PRESET: RateLimitOptions = {
  limit: 5,
  windowMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * In-memory sliding-window log per IP & endpoint key.
 * Stores an array of timestamps of requests within the window.
 */
interface SlidingLog {
  timestamps: number[];
}

const memorySlidingWindows = new Map<string, SlidingLog>();

/**
 * Memory sliding-window rate limit checker.
 * Accurate down to the millisecond.
 */
function checkMemorySlidingWindow(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = memorySlidingWindows.get(key);
  if (!record) {
    record = { timestamps: [] };
    memorySlidingWindows.set(key, record);
  }

  // Filter out timestamps outside the active window
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);

  if (record.timestamps.length >= options.limit) {
    const oldest = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldest + options.windowMs - now);
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, options.limit - record.timestamps.length);
  const oldest = record.timestamps[0] || now;
  const resetMs = Math.max(0, oldest + options.windowMs - now);

  return {
    success: true,
    limit: options.limit,
    remaining,
    resetMs,
  };
}

/**
 * Upstash Redis Sliding Window using REST API (HTTP fetch).
 * Operates without requiring node-redis TCP sockets or extra heavy packages.
 */
async function checkUpstashRateLimit(
  key: string,
  options: RateLimitOptions,
  url: string,
  token: string
): Promise<RateLimitResult | null> {
  try {
    const now = Date.now();
    const clearBefore = now - options.windowMs;
    const redisKey = `ratelimit:${key}`;

    // Pipeline: 
    // 1. ZREMRANGEBYSCORE key 0 clearBefore
    // 2. ZADD key now now
    // 3. ZCARD key
    // 4. EXPIRE key windowSec
    const windowSec = Math.ceil(options.windowMs / 1000);
    const pipelineCommands = [
      ['ZREMRANGEBYSCORE', redisKey, '0', clearBefore.toString()],
      ['ZADD', redisKey, now.toString(), `${now}-${Math.random().toString(36).substring(7)}`],
      ['ZCARD', redisKey],
      ['EXPIRE', redisKey, windowSec.toString()],
    ];

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipelineCommands),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[RateLimit] Upstash Redis returned non-200, falling back to memory sliding window');
      return null;
    }

    const json = await response.json();
    // Result of ZCARD is at index 2
    const currentCount = Number(json[2]?.result) || 1;

    if (currentCount > options.limit) {
      return {
        success: false,
        limit: options.limit,
        remaining: 0,
        resetMs: options.windowMs,
      };
    }

    return {
      success: true,
      limit: options.limit,
      remaining: Math.max(0, options.limit - currentCount),
      resetMs: options.windowMs,
    };
  } catch (err) {
    console.warn('[RateLimit] Error connecting to Upstash Redis, falling back to in-memory sliding window:', err);
    return null;
  }
}

/**
 * Universal Rate Limiter:
 * Uses Upstash Redis if UPSTASH_REDIS_REST_URL is configured,
 * otherwise transparently uses an in-memory sliding window.
 */
export async function checkRateLimitAsync(
  ip: string,
  endpoint: string,
  options: RateLimitOptions = AI_RATE_LIMIT_PRESET
): Promise<RateLimitResult> {
  const sanitizedIp = ip.trim().replace(/^::ffff:/, '') || 'anonymous';
  const key = `${endpoint}:${sanitizedIp}`;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    const upstashResult = await checkUpstashRateLimit(key, options, upstashUrl, upstashToken);
    if (upstashResult) {
      return upstashResult;
    }
  }

  // In-memory sliding window fallback
  return checkMemorySlidingWindow(key, options);
}

/**
 * Synchronous backwards-compatible version for existing routes.
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions = AI_RATE_LIMIT_PRESET
): RateLimitResult {
  const sanitizedIp = ip.trim().replace(/^::ffff:/, '') || 'anonymous';
  const key = `${endpoint}:${sanitizedIp}`;
  return checkMemorySlidingWindow(key, options);
}

/**
 * Extracts the true client IP from standard reverse-proxy headers (e.g. Vercel, Cloudflare, NGINX).
 */
export function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return (req as any).ip || '127.0.0.1';
}

// Garbage collector for in-memory windows every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    memorySlidingWindows.forEach((record, key) => {
      // Remove timestamps older than 15 minutes
      record.timestamps = record.timestamps.filter((ts: number) => now - ts < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        memorySlidingWindows.delete(key);
      }
    });
  }, 60000).unref?.();
}

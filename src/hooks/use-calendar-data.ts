'use client';

import useSWR from 'swr';
import { useMemo, useCallback } from 'react';

const CALENDAR_CACHE_KEY = 'cached_calendar_events_v2';
const BLOCKED_DAYS_CACHE_KEY = 'cached_blocked_days_v2';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err: any = new Error(`Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// Retry transient failures (cold starts, DB hiccups) but never retry auth errors
const onErrorRetry = (err: any, _key: string, _config: any, revalidate: any, { retryCount }: { retryCount: number }) => {
  if (err?.status === 401 || err?.status === 404) return;
  if (retryCount >= 4) return;
  setTimeout(() => revalidate({ retryCount }), 1000 * (retryCount + 1));
};

export function getCachedCalendarEvents(): any | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(CALENDAR_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data)) {
      return parsed;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return undefined;
}

export function saveCachedCalendarEvents(data: any): void {
  if (typeof window === 'undefined' || !data) return;
  try {
    if (Array.isArray(data.data)) {
      localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export function getCachedBlockedDays(): string[] | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(BLOCKED_DAYS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return undefined;
}

export function saveCachedBlockedDays(dates: string[]): void {
  if (typeof window === 'undefined' || !dates) return;
  try {
    localStorage.setItem(BLOCKED_DAYS_CACHE_KEY, JSON.stringify(dates));
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Pre-fetch calendar events into browser memory / SWR cache.
 * Call on mouse hover or on idle to achieve 0ms perception before the user even clicks.
 */
export function prefetchCalendarEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/calendar/events').then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        saveCachedCalendarEvents(data);
      }
    }).catch(() => {});
  } catch {}
}

export function useCalendarEvents() {
  const fallbackData = typeof window !== 'undefined' ? getCachedCalendarEvents() : undefined;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    '/api/calendar/events',
    fetcher,
    {
      fallbackData,
      revalidateOnFocus: true,
      revalidateIfStale: true,
      keepPreviousData: true,
      onErrorRetry,
      onSuccess: (freshData) => {
        saveCachedCalendarEvents(freshData);
      },
    }
  );

  const customMutate = useCallback(
    async (...args: any[]) => {
      const res = await (mutate as any)(...args);
      if (res?.data) {
        saveCachedCalendarEvents(res);
      }
      return res;
    },
    [mutate]
  );

  const resolvedData = data || fallbackData;
  const events = (resolvedData?.data || []) as any[];
  // If we have cached data, we are NOT in a blocking loading state!
  const isReallyLoading = isLoading && events.length === 0;

  return {
    data: resolvedData,
    events,
    error,
    isLoading: isReallyLoading,
    isValidating,
    mutate: customMutate,
  };
}

export function useBlockedDays() {
  const cached = typeof window !== 'undefined' ? getCachedBlockedDays() : undefined;
  const fallbackData = cached ? { data: cached } : undefined;

  const { data, mutate } = useSWR('/api/blocked-days', fetcher, {
    fallbackData,
    revalidateOnFocus: true,
    revalidateIfStale: true,
    keepPreviousData: true,
    onErrorRetry,
    onSuccess: (fresh) => {
      if (Array.isArray(fresh?.data)) {
        saveCachedBlockedDays(fresh.data);
      }
    },
  });

  const rawDates: string[] = data?.data || cached || [];
  const blockedDays = useMemo(() => new Set<string>(rawDates), [rawDates]);

  return {
    data,
    blockedDays,
    rawDates,
    mutate,
  };
}

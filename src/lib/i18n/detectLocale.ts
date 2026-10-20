export type Locale = 'nl' | 'en';

export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_STORAGE_KEY = 'studyplanner_locale';

/**
 * Checks whether headers indicate a user connecting from the Netherlands.
 */
export function detectLocaleFromHeaders(headers: {
  get: (name: string) => string | null | undefined;
}): Locale | null {
  // 1. Explicit cookie override
  const cookieHeader = headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  if (match) {
    const val = decodeURIComponent(match[1]).toLowerCase();
    if (val === 'nl' || val === 'en') return val;
  }

  // 2. Geo IP Country Headers (Vercel, Cloudflare, standard reverse proxies)
  const country = (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    headers.get('x-country-code') ||
    headers.get('geoip-country-code') ||
    ''
  ).trim().toUpperCase();

  if (country) {
    return country === 'NL' ? 'nl' : 'en';
  }

  // 3. Fallback to Accept-Language header
  const acceptLang = (headers.get('accept-language') || '').toLowerCase();
  if (acceptLang.includes('nl')) {
    return 'nl';
  }

  return null;
}

/**
 * Client-side detection when cookies/headers aren't definitive or in dev mode.
 */
export function detectClientLocale(): Locale {
  if (typeof window === 'undefined') return 'en';

  // 1. Check localStorage or Cookie
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'nl' || saved === 'en') return saved;
  } catch {}

  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  if (match) {
    const val = decodeURIComponent(match[1]).toLowerCase();
    if (val === 'nl' || val === 'en') return val;
  }

  // 2. Check Timezone (Amsterdam = Netherlands)
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === 'Europe/Amsterdam') {
      return 'nl';
    }
  } catch {}

  // 3. Check browser language (Dutch)
  const navLang = (navigator.language || '').toLowerCase();
  const navLangs = navigator.languages ? Array.from(navigator.languages).map(l => l.toLowerCase()) : [];
  if (navLang.startsWith('nl') || navLangs.some(l => l.startsWith('nl'))) {
    return 'nl';
  }

  // Outside Netherlands default to English
  return 'en';
}

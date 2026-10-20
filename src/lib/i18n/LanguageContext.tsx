'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { en } from './locales/en';
import { nl } from './locales/nl';
import { Locale, LOCALE_COOKIE, LOCALE_STORAGE_KEY, detectClientLocale } from './detectLocale';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isDutch: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  isDutch: false,
  t: (key: string) => key,
});

const DICTIONARIES = {
  en,
  nl,
};

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || 'en');

  // Detect and synchronize on client mount
  useEffect(() => {
    // If no initialLocale from server or if client has localStorage saved
    const detected = detectClientLocale();
    setLocaleState(detected);
    try {
      document.documentElement.lang = detected;
    } catch {}
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      // Save cookie with 1 year max-age for server-side recognition
      document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const activeDict = DICTIONARIES[locale] || DICTIONARIES.en;
      let text = getNestedValue(activeDict, key);

      // Fallback to English if missing in Dutch
      if (!text && locale !== 'en') {
        text = getNestedValue(DICTIONARIES.en, key);
      }

      if (!text) {
        // Return last key component as friendly fallback
        return key.split('.').pop() || key;
      }

      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }

      return text;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      isDutch: locale === 'nl',
      t,
    }),
    [locale, setLocale, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const useTranslation = useLanguage;

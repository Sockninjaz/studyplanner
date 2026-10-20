import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/shared/auth-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { TimerProvider } from "@/components/session/timer-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trumley • The Intelligent AI Exam Planner",
  description: "Intelligent waterfill exam scheduling and proactive AI coaching for ambitious students.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { headers } from "next/headers";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { detectLocaleFromHeaders } from "@/lib/i18n/detectLocale";

// Suppress React 19 false-positive console error regarding next-themes script tag and third-party flushSync
if (typeof console !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Encountered a script tag') ||
       args[0].includes('flushSync was called from inside a lifecycle method'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialLocale: 'nl' | 'en' = 'en';
  try {
    const h = await headers();
    const detected = detectLocaleFromHeaders(h);
    if (detected) initialLocale = detected;
  } catch {}

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <LanguageProvider initialLocale={initialLocale}>
              <TimerProvider>
                {children}
              </TimerProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

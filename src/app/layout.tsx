import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/shared/auth-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { TimerProvider } from "@/components/session/timer-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Study Planner",
  description: "AI assisted study planner for students",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <TimerProvider>
              {children}
            </TimerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

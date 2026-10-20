'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to request reset:', error);
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 px-4 py-8 relative transition-colors duration-200">
      {mounted && (
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all"
          aria-label="Toggle Dark Mode"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      )}

      <div className="w-full max-w-[420px] mx-auto">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600 text-white dark:text-slate-900 mb-3.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter your email to receive a reset link</p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm border border-slate-200/90 dark:border-slate-800">
          {submitted ? (
            <div className="text-center">
              <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium border border-emerald-100 dark:border-emerald-500/20">
                If an account exists for {email}, you will receive a password reset link shortly.
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleSubmit()}
                  disabled={isLoading}
                  className={`w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all text-sm ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Sending...' : 'Resend Email'}
                </button>
                <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors text-sm">
                  Return to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="email">
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-600/15 outline-none transition-all"
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                className={`w-full rounded-xl bg-indigo-600 py-2.5 px-4 font-semibold text-white dark:text-slate-900 hover:bg-indigo-700 shadow-sm transition-all text-sm mt-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
          
          {!submitted && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <Link href="/login" className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

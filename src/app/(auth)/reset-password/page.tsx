'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <div className="mb-5 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-500/20">
          Invalid or missing reset token.
        </div>
        <Link href="/forgot-password" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium border border-emerald-100 dark:border-emerald-500/20">
          Password reset successfully! Redirecting to login...
        </div>
        <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors text-sm">
          Return to login now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="password">
          New Password
        </label>
        <input
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-600/15 outline-none transition-all"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="confirmPassword">
          Confirm New Password
        </label>
        <input
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-600/15 outline-none transition-all"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      <button
        className={`w-full rounded-xl bg-indigo-600 py-2.5 px-4 font-semibold text-white dark:text-slate-900 hover:bg-indigo-700 shadow-sm transition-all text-sm mt-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 px-4 py-8 relative">
      <div className="w-full max-w-[420px] mx-auto">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600 text-white dark:text-slate-900 mb-3.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Set New Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please enter your new password below</p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm border border-slate-200/90 dark:border-slate-800">
          <Suspense fallback={<div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

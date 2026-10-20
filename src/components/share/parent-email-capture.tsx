'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ParentEmailCaptureProps {
  shareToken: string;
}

export default function ParentEmailCapture({ shareToken }: ParentEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`/api/share/${shareToken}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'An error occurred while saving.');
      }

      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not register email.');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 sm:p-8 shadow-sm">
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 bg-[#9EC29A]/15 dark:bg-[#9EC29A]/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#9EC29A]/20 text-[#4E774A] dark:text-[#B2D8AE] mb-3">
          <Mail className="w-3.5 h-3.5" />
          <span>Weekly Parent Updates</span>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Are you a parent and want weekly progress updates? Leave your email address below.
        </h3>
        
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Receive a concise summary of completed study tasks, planned study hours, and approaching tests every Sunday evening. No spam, unsubscribe anytime.
        </p>

        {status === 'success' ? (
          <div className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-[#9EC29A]/20 dark:bg-[#9EC29A]/15 border border-[#9EC29A]/40 text-[#365A33] dark:text-[#C5E8C2] animate-in fade-in duration-300">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-[#4E774A] dark:text-[#9EC29A]" />
            <p className="text-sm font-medium">
              Thank you! Your email has been registered. You will receive the next progress update.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="email"
                  required
                  placeholder="parent@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  disabled={status === 'loading'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9EC29A] focus:border-transparent text-sm transition-shadow disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#9EC29A] hover:bg-[#8eb58a] text-slate-950 font-semibold text-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Subscribe</span>
                )}
              </button>
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              GDPR compliant. Your email address is exclusively used for study updates for this student and never shared with third parties.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

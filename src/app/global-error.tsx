'use client';

import React, { useEffect } from 'react';
import { captureApiException } from '@/lib/monitoring/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureApiException(error, { digest: error.digest, scope: 'global-error-root' });
  }, [error]);

  return (
    <html lang="nl">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 mb-5">
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Er is een kritieke fout opgetreden
          </h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Het systeem kon de applicatie niet laden. De fout is veilig geregistreerd in onze monitoring zonder gevoelige gegevens.
          </p>

          {error.digest && (
            <div className="mt-4 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-500 truncate">
              Foutcode: {error.digest}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-xl bg-[#9EC29A] hover:bg-[#8eb58a] text-slate-950 font-bold text-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              Opnieuw proberen
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
            >
              Naar startpagina
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureApiException } from '@/lib/monitoring/sentry';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureApiException(error, { digest: error.digest, scope: 'app-error-boundary' });
  }, [error]);

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          Er is iets misgegaan
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          Er is een onverwachte fout opgetreden bij het laden van deze pagina. De fout is geregistreerd in onze veilige audit-monitoring.
        </p>

        {error.digest && (
          <div className="mb-6 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono text-slate-500 truncate">
            Referentiecode: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#9EC29A] hover:bg-[#8eb58a] text-slate-950 font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Opnieuw proberen</span>
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

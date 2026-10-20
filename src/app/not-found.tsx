import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      <span className="text-[12rem] font-black text-slate-200/50 dark:text-slate-800/40 select-none absolute -z-10 tracking-tighter">
        404
      </span>

      <div className="max-w-md w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
          Pagina niet gevonden
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          De opgevraagde pagina of deellink bestaat niet, is verwijderd of ingetrokken.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#9EC29A] hover:bg-[#8eb58a] text-slate-950 font-bold text-sm shadow-sm transition-all active:scale-[0.98]"
        >
          <Home className="w-4 h-4" />
          <span>Terug naar dashboard</span>
        </Link>
      </div>
    </div>
  );
}

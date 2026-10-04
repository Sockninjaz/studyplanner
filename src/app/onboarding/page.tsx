'use client';

import './onboarding.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If the user already has a profile token, skip onboarding
    const token = localStorage.getItem('studyplanner_profile');
    if (token) {
      router.replace('/today');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="ob-splash bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center min-h-screen">
        <div className="w-9 h-9 border-3 border-indigo-200 dark:border-slate-800 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="ob-root bg-[#F8FAFC] dark:bg-slate-950 relative min-h-screen flex items-center justify-center p-4 sm:p-6" aria-label="Study Planner onboarding">
      {/* Dark / Light Mode Switch in the corner */}
      <div className="fixed top-5 right-5 z-50">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm cursor-pointer"
          title={mounted && theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          type="button"
          aria-label="Toggle theme"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          )}
        </button>
      </div>

      <OnboardingWizard />
    </main>
  );
}

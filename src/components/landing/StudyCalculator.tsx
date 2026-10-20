'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, CheckCircle2, Sparkles, Shield, Clock } from 'lucide-react';

export default function StudyCalculator() {
  const [examCount, setExamCount] = useState<number>(3);
  const [weeksRemaining, setWeeksRemaining] = useState<number>(3);
  const [intensity, setIntensity] = useState<'relaxed' | 'balanced' | 'deep'>('balanced');

  // Multiplier hours per exam depending on intensity
  const examHourRequirements: Record<'relaxed' | 'balanced' | 'deep', number> = {
    relaxed: 10,
    balanced: 15,
    deep: 22,
  };

  const totalRequiredHours = examCount * examHourRequirements[intensity];
  const totalDays = weeksRemaining * 7;
  // Reserve 1 rest day per week + 1 final review day before each exam
  const restDays = Math.max(1, Math.floor(weeksRemaining * 1.5));
  const activeStudyDays = Math.max(1, totalDays - restDays);

  const dailyMinutes = Math.round((totalRequiredHours * 60) / activeStudyDays);
  const dailyHoursFormatted = `${Math.floor(dailyMinutes / 60)}h ${dailyMinutes % 60}m`;
  const totalSessions = Math.round(totalRequiredHours * 2); // 30-min sessions
  const crammingHoursSaved = Math.round(totalRequiredHours * 0.75);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-xl shadow-[#9EC29A]/5">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#9EC29A]/15 text-[#30522c] dark:text-[#C5E8C2] border border-[#9EC29A]/30 mb-3">
          <Calculator className="w-3.5 h-3.5" />
          <span>Interactive Study Load Simulator</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          See your ideal daily study pace
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Adjust your upcoming exams and timeline to see how Trumley waterfills your workload into stress-free micro-sessions.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-center">
        {/* Controls Column */}
        <div className="md:col-span-7 space-y-6">
          {/* Exam count */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Upcoming Exams:
              </label>
              <span className="text-sm font-black text-[#30522c] dark:text-[#9EC29A]">
                {examCount} {examCount === 1 ? 'Exam' : 'Exams'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setExamCount(num)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    examCount === num
                      ? 'bg-[#9EC29A] text-slate-950 border-[#9EC29A] shadow-xs scale-105'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#9EC29A]'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Weeks remaining */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Time until Exam Week:
              </label>
              <span className="text-sm font-black text-[#30522c] dark:text-[#9EC29A]">
                {weeksRemaining} {weeksRemaining === 1 ? 'Week' : 'Weeks'} ({totalDays} days)
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeksRemaining(w)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    weeksRemaining === w
                      ? 'bg-[#9EC29A] text-slate-950 border-[#9EC29A] shadow-xs scale-105'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#9EC29A]'
                  }`}
                >
                  {w} {w === 1 ? 'wk' : 'wks'}
                </button>
              ))}
            </div>
          </div>

          {/* Desired Pace / Intensity */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              Study Pace Preference:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'relaxed', label: 'Light', desc: '10h / exam' },
                { id: 'balanced', label: 'Balanced', desc: '15h / exam' },
                { id: 'deep', label: 'Thorough', desc: '22h / exam' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIntensity(item.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    intensity === item.id
                      ? 'bg-[#9EC29A]/15 border-[#9EC29A] text-slate-900 dark:text-white ring-1 ring-[#9EC29A]'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Results Column */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#9EC29A]/10 via-slate-50 to-[#9EC29A]/5 dark:from-[#9EC29A]/10 dark:via-slate-800/50 dark:to-slate-900 p-6 rounded-2xl border border-[#9EC29A]/30 space-y-5">
          <div className="text-center pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Calculated Daily Commitment
            </span>
            <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mt-1">
              {dailyHoursFormatted}
            </div>
            <p className="text-xs text-[#30522c] dark:text-[#9EC29A] font-semibold mt-1">
              per study day (30-min sessions)
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#9EC29A]" /> Total Study Sessions:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{totalSessions} sessions</span>
            </div>

            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /> Protected Rest Days:
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{restDays} rest days</span>
            </div>

            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Night-Before Panic Saved:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">~{crammingHoursSaved} hours</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/register"
              className="w-full py-3 px-4 rounded-xl bg-[#9EC29A] hover:bg-[#86B382] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#9EC29A]/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <span>Build this plan in Trumley</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Free forever for individual students • Takes 60 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

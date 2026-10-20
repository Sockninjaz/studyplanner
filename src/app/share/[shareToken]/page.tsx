'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  ShieldCheck, 
  AlertCircle, 
  Loader2,
  TrendingUp,
} from 'lucide-react';
import ParentEmailCapture from '@/components/share/parent-email-capture';

interface ExamItem {
  id: string;
  subject: string;
  date: string;
  color: string;
  isCompleted: boolean;
  daysUntil: number;
  chaptersCount: number;
}

interface TimelineItem {
  id: string;
  title: string;
  shortTitle: string;
  subject: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  tasksCount: number;
  checklistCount: number;
}

interface ShareData {
  academicContext: string | null;
  summary: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    totalHours: number;
    completedHours: number;
    totalExams: number;
    upcomingExamsCount: number;
  };
  upcomingExams: ExamItem[];
  timeline: TimelineItem[];
}

export default function PublicSharePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = React.use(params);
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShareData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/share/${shareToken}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || 'Could not load study schedule');
        }

        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (shareToken) {
      loadShareData();
    }
  }, [shareToken]);

  const formatDateEn = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDurationEn = (startStr: string, endStr: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const mins = Math.round((e.getTime() - s.getTime()) / 60000);
      return mins > 0 ? `${mins} min` : '';
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#9EC29A]/20 flex items-center justify-center text-[#4E774A] dark:text-[#9EC29A] animate-pulse">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#9EC29A]" />
            <span>Synchronizing study schedule...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Study Plan Unavailable</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {error || 'The requested share link is invalid, expired, or revoked by the student.'}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-[#9EC29A]/30">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#9EC29A] text-slate-950 flex items-center justify-center font-bold text-sm shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white block">
                StudyPlanner
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block -mt-0.5">
                Parent & Mentor Overview
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#9EC29A]/15 text-[#3e663a] dark:text-[#B5DCB1] border border-[#9EC29A]/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Read-only View</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Hero Title & Context */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#9EC29A] animate-ping" />
              <span className="text-xs uppercase tracking-wider font-bold text-[#4E774A] dark:text-[#9EC29A]">
                Live Study Schedule
              </span>
              {data.academicContext && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {data.academicContext}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Study Timeline & Progress
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Track exam preparation, scheduled study sessions, and milestone completion in real time without needing an account.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 text-[#9EC29A]" />
            <span>Updated just now</span>
          </div>
        </div>

        {/* High-Level Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Completion Rate */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progress</span>
              <TrendingUp className="w-4 h-4 text-[#9EC29A]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {data.summary.completionRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-[#9EC29A] h-full rounded-full transition-all duration-700" 
                style={{ width: `${data.summary.completionRate}%` }} 
              />
            </div>
          </div>

          {/* Card 2: Completed Study Hours */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Study Time</span>
              <Clock className="w-4 h-4 text-[#9EC29A]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {data.summary.completedHours}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                / {data.summary.totalHours} hrs
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Planned & completed hours
            </p>
          </div>

          {/* Card 3: Completed Sessions */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sessions</span>
              <CheckCircle2 className="w-4 h-4 text-[#9EC29A]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {data.summary.completedSessions}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                / {data.summary.totalSessions} done
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Completed study blocks
            </p>
          </div>

          {/* Card 4: Upcoming Exams */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Exams</span>
              <BookOpen className="w-4 h-4 text-[#9EC29A]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {data.summary.upcomingExamsCount}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                approaching
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              {data.summary.totalExams} registered in total
            </p>
          </div>
        </div>

        {/* Section: Upcoming Exam Dates */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#9EC29A]" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Upcoming Exams & Tests
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {data.upcomingExams.length} tests scheduled
            </span>
          </div>

          {data.upcomingExams.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              No exams scheduled at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.upcomingExams.map((exam) => (
                <div 
                  key={exam.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: exam.color || '#9EC29A' }} 
                        />
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {exam.subject}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {exam.chaptersCount > 0 ? `${exam.chaptersCount} chapters / topics` : 'Full curriculum'}
                      </p>
                    </div>

                    {exam.isCompleted ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#9EC29A]/20 text-[#365A33] dark:text-[#C5E8C2]">
                        Completed
                      </span>
                    ) : exam.daysUntil <= 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Today
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        In {exam.daysUntil} {exam.daysUntil === 1 ? 'day' : 'days'}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Date:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDateEn(exam.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section: Study Timeline & Sessions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9EC29A]" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Study Timeline
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {data.timeline.length} planned sessions
            </span>
          </div>

          {data.timeline.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              There are currently no scheduled study sessions.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
              {data.timeline.map((session) => (
                <div 
                  key={session.id}
                  className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex-shrink-0">
                      {session.isCompleted ? (
                        <div className="w-7 h-7 rounded-full bg-[#9EC29A]/20 text-[#365A33] dark:text-[#9EC29A] flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center" />
                      )}
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {session.shortTitle || session.title}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {session.subject}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{formatDateEn(session.startTime)}</span>
                        {formatDurationEn(session.startTime, session.endTime) && (
                          <>
                            <span>•</span>
                            <span>{formatDurationEn(session.startTime, session.endTime)}</span>
                          </>
                        )}
                        {session.tasksCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{session.tasksCount} {session.tasksCount === 1 ? 'task' : 'tasks'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {session.isCompleted ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#9EC29A]/20 text-[#365A33] dark:text-[#B5DCB1]">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section: Email-capture Component for Parents */}
        <section className="pt-2">
          <ParentEmailCapture shareToken={shareToken} />
        </section>

      </main>

      {/* Footer with Legal Links */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#9EC29A]" />
            <span>GDPR Protected • Data hosted within the EU</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/voorwaarden" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

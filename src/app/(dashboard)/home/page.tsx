'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Exam {
  _id: string;
  subject: string;
  color?: string;
  date: string;
  isCompleted?: boolean;
}

interface StudySession {
  _id: string;
  title: string;
  shortTitle?: string;
  subject: string;
  startTime: string;
  isCompleted: boolean;
  exam?: Exam;
}

const EXAM_COLORS = [
  'rgb(253, 231, 76)',
  'rgb(72, 86, 150)',
  'rgb(250, 175, 205)',
  'rgb(66, 191, 221)',
  'rgb(167, 139, 250)',
  'rgb(52, 211, 153)',
  'rgb(251, 146, 60)',
  'rgb(45, 212, 191)',
];

function getExamColor(exam?: { _id: string; color?: string }): string {
  if (!exam) return 'rgb(100, 116, 139)';
  if (exam.color) return exam.color;
  let hash = 0;
  for (let i = 0; i < exam._id.length; i++) {
    hash = ((hash << 5) - hash) + exam._id.charCodeAt(i);
    hash |= 0;
  }
  return EXAM_COLORS[Math.abs(hash) % EXAM_COLORS.length];
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const exam = new Date(dateStr);
  return Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatTime(timeStr: string): string {
  const d = new Date(timeStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function MobileHomePage() {
  const router = useRouter();

  const [allSessions, setAllSessions] = useState<StudySession[]>([]);
  const [todaySessions, setTodaySessions] = useState<StudySession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then(r => r.json()),
      fetch('/api/sessions?date=today').then(r => r.json()),
      fetch('/api/exams').then(r => r.json()),
    ]).then(([all, todayData, examsData]) => {
      setAllSessions(all.data || []);
      setTodaySessions(todayData.data || []);
      setExams(examsData.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Group all sessions by exam
  const examProgress = exams
    .filter(e => !e.isCompleted)
    .map(exam => {
      const sessions = allSessions.filter(s => s.exam?._id === exam._id);
      const completed = sessions.filter(s => s.isCompleted).length;
      const total = sessions.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const daysLeft = getDaysUntil(exam.date);
      return { exam, completed, total, pct, daysLeft };
    })
    .filter(ep => ep.total > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Overall stats
  const totalSessions = allSessions.length;
  const completedSessions = allSessions.filter(s => s.isCompleted).length;
  const overallPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900 no-scrollbar">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] px-5 pt-6 pb-8 border-b border-slate-200/80 dark:border-slate-700 shadow-sm">
        <p className="text-slate-500 dark:text-zinc-400 text-sm">{today}</p>
        <h1 className="text-slate-900 dark:text-white text-2xl font-bold mt-1">Good{
          (() => {
            const h = new Date().getHours();
            if (h < 12) return ' morning';
            if (h < 17) return ' afternoon';
            return ' evening';
          })()
        } 👋</h1>

        {/* Overall progress pill */}
        {!loading && totalSessions > 0 && (
          <div className="mt-5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 dark:text-zinc-200 font-semibold text-sm">Overall Progress</span>
              <span className="text-slate-900 dark:text-white font-bold text-sm">{overallPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-900 dark:bg-white transition-all duration-700"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="text-slate-500 dark:text-zinc-400 text-xs mt-2">
              {completedSessions} of {totalSessions} sessions completed
            </p>
          </div>
        )}
      </div>

      {/* Content cards */}
      <div className="px-4 -mt-4 space-y-4 pb-6">

        {/* Today's Sessions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-white text-base">Today's Sessions</h2>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {todaySessions.filter(s => !s.isCompleted).length} remaining
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No sessions today!</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Enjoy your day off.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {todaySessions.map(s => {
                const color = getExamColor(s.exam);
                return (
                  <button
                    key={s._id}
                    onClick={() => router.push(`/today?session=${s._id}`)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${s.isCompleted ? 'opacity-50' : ''}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold text-slate-700 dark:text-slate-200 truncate ${s.isCompleted ? 'line-through' : ''}`}>
                        {s.exam?.subject || s.subject}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {s.shortTitle || s.title}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {s.isCompleted ? (
                        <span className="text-green-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-Exam Progress */}
        {!loading && examProgress.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-800 dark:text-white text-base">Exam Progress</h2>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {examProgress.map(({ exam, completed, total, pct, daysLeft }) => {
                const color = getExamColor(exam);
                return (
                  <div key={exam._id} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {exam.subject}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2">
                        {pct}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {completed}/{total} sessions
                      </span>
                      <span className={`text-[11px] font-medium ${
                        daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {daysLeft <= 0 ? 'Today!' : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick link to full schedule */}
        <button
          onClick={() => router.push('/calendar')}
          className="w-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">View Full Schedule</span>
          </div>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

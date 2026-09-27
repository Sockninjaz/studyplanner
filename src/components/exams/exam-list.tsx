'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, CheckCircle, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Tab = 'upcoming' | 'completed';

export default function ExamList() {
  const { data, error, isLoading } = useSWR('/api/exams', fetcher);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [celebratedExams, setCelebratedExams] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Only run on client
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('celebratedExams');
      if (stored) {
        setCelebratedExams(new Set(JSON.parse(stored)));
      }
    }
  }, []);

  if (error) return <div className="text-red-500">Failed to load exams. Please try again.</div>;
  if (isLoading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  const exams = data?.data || [];
  
  // Confetti trigger
  exams.forEach((exam: any) => {
    if (exam.progressPercentage === 100 && !celebratedExams.has(exam._id)) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
      });
      const newCelebrated = new Set(celebratedExams).add(exam._id);
      setCelebratedExams(newCelebrated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('celebratedExams', JSON.stringify(Array.from(newCelebrated)));
      }
    }
  });
  
  const upcomingExams = exams.filter((exam: any) => !exam.isCompleted);
  const completedExams = exams.filter((exam: any) => exam.isCompleted);

  const displayedExams = activeTab === 'upcoming' ? upcomingExams : completedExams;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'upcoming' 
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Upcoming ({upcomingExams.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'completed' 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Completed ({completedExams.length})
        </button>
      </div>

      {/* Grid of Exams */}
      {displayedExams.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No {activeTab} exams</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {activeTab === 'upcoming' ? "You're all caught up! Time to relax or add a new exam." : "You haven't completed any exams yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayedExams.map((exam: any) => {
            const progress = exam.progressPercentage || 0;
            const isCompleted = progress === 100 || exam.isCompleted;

            return (
              <Link 
                href={`/exams/${exam._id}`} 
                key={exam._id}
                className="group relative bg-white dark:bg-slate-900 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="inline-block px-2 md:px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] md:text-xs font-bold rounded-full mb-2 uppercase tracking-wider">
                      {exam.subject}
                    </span>
                    <h3 className={`text-lg md:text-xl font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'} transition-colors line-clamp-1`}>
                      {exam.title}
                    </h3>
                  </div>
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors flex-shrink-0">
                    <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-4 md:mb-6 font-medium">
                  <div className="flex items-center gap-1.5" suppressHydrationWarning>
                    <Calendar size={14} className="md:w-4 md:h-4" />
                    {new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={14} className="md:w-4 md:h-4" />
                    {exam.studyMaterials?.length || 0} Topics
                  </div>
                </div>

                {/* Progress Section */}
                <div className="mt-auto">
                  {isCompleted ? (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20 w-full justify-center">
                      <CheckCircle size={18} />
                      <span className="font-bold text-sm">100% Completed</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">Progress</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{progress}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-1000 ease-out relative overflow-hidden"
                          style={{ width: `${progress}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, CheckCircle, ChevronRight, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Tab = 'upcoming' | 'completed';

export default function ExamList() {
  const { locale, t } = useLanguage();
  const { data, error, isLoading, mutate: mutateExamList } = useSWR('/api/exams', fetcher);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [celebratedExams, setCelebratedExams] = useState<Set<string>>(new Set());
  const [examToDelete, setExamToDelete] = useState<{ id: string; subject: string } | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);

  useEffect(() => {
    if (!examToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeletingExam) {
        setExamToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [examToDelete, isDeletingExam]);

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete || isDeletingExam) return;
    setIsDeletingExam(true);
    try {
      const res = await fetch(`/api/exams/${examToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete exam');
      }
      await mutateExamList();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('examDeleted', { detail: { examId: examToDelete.id } }));
      }
      setExamToDelete(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete exam');
    } finally {
      setIsDeletingExam(false);
    }
  };

  const exams = data?.data || [];

  useEffect(() => {
    // Only run on client after data is loaded
    if (typeof window === 'undefined' || !exams || exams.length === 0) return;

    let storedCelebrated: string[] = [];
    const stored = localStorage.getItem('celebratedExams');
    if (stored) {
      try {
        storedCelebrated = JSON.parse(stored);
      } catch (e) {
        // Ignore parse error
      }
    }
    
    const celebratedSet = new Set(storedCelebrated);
    let newlyCelebrated = false;

    exams.forEach((exam: any) => {
      // Check if progress is 100% or exam is marked completed, and we haven't celebrated yet
      if ((exam.progressPercentage === 100 || exam.isCompleted) && !celebratedSet.has(exam._id)) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
        });
        celebratedSet.add(exam._id);
        newlyCelebrated = true;
      }
    });

    if (newlyCelebrated) {
      localStorage.setItem('celebratedExams', JSON.stringify(Array.from(celebratedSet)));
      setCelebratedExams(celebratedSet);
    } else if (celebratedExams.size === 0 && celebratedSet.size > 0) {
      setCelebratedExams(celebratedSet);
    }
  }, [exams]);

  if (error) return <div className="text-red-500">Failed to load exams. Please try again.</div>;
  if (isLoading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
  
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
          {t('exams.upcoming')} ({upcomingExams.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'completed' 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t('exams.completed')} ({completedExams.length})
        </button>
      </div>

      {/* Grid of Exams */}
      {displayedExams.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {locale === 'nl' 
              ? (activeTab === 'upcoming' ? 'Geen aankomende toetsen' : 'Geen afgeronde toetsen') 
              : `No ${activeTab} exams`}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {activeTab === 'upcoming' 
              ? (locale === 'nl' ? 'Je bent helemaal bij! Tijd om te ontspannen of een nieuwe toets toe te voegen.' : "You're all caught up! Time to relax or add a new exam.") 
              : (locale === 'nl' ? 'Je hebt nog geen toetsen afgerond.' : "You haven't completed any exams yet.")}
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
                  <div className="min-w-0 pr-2">
                    <span className="inline-block px-2 md:px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] md:text-xs font-bold rounded-full mb-2 uppercase tracking-wider">
                      {exam.subject}
                    </span>
                    <h3 className={`text-lg md:text-xl font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400'} transition-colors line-clamp-1`}>
                      {exam.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExamToDelete({ id: exam._id, subject: exam.subject || exam.title });
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all opacity-0 group-hover:opacity-100"
                      title={locale === 'nl' ? 'Toets verwijderen' : 'Delete exam'}
                      aria-label={`Delete ${exam.subject || exam.title}`}
                    >
                      <Trash2 size={14} className="md:w-[15px] md:h-[15px]" />
                    </button>
                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-4 md:mb-6 font-medium">
                  <div className="flex items-center gap-1.5" suppressHydrationWarning>
                    <Calendar size={14} className="md:w-4 md:h-4" />
                    {new Date(exam.date).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={14} className="md:w-4 md:h-4" />
                    {exam.studyMaterials?.length || 0} {locale === 'nl' ? 'Onderwerpen' : 'Topics'}
                  </div>
                </div>

                {/* Progress Section */}
                <div className="mt-auto">
                  {isCompleted ? (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20 w-full justify-center">
                      <CheckCircle size={18} />
                      <span className="font-bold text-sm">{locale === 'nl' ? '100% Afgerond' : '100% Completed'}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">{locale === 'nl' ? 'Voortgang' : 'Progress'}</span>
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

      {/* Delete Exam Confirmation Modal */}
      {examToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingExam) {
              setExamToDelete(null);
            }
          }}
        >
          <div 
            className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5 text-red-600 dark:text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {locale === 'nl' ? 'Toets verwijderen?' : 'Delete Exam?'}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6 text-sm leading-relaxed">
              {locale === 'nl'
                ? <>Weet je zeker dat je <strong className="text-gray-900 dark:text-white">{examToDelete.subject}</strong> wilt verwijderen? Hiermee worden alle gekoppelde studiesessies definitief verwijderd. Dit kan niet ongedaan worden gemaakt.</>
                : <>Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{examToDelete.subject}</strong>? This will permanently delete all associated study sessions. This action cannot be undone.</>}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                disabled={isDeletingExam}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExam}
                disabled={isDeletingExam}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingExam ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {locale === 'nl' ? 'Bezig met verwijderen...' : 'Deleting...'}
                  </>
                ) : (locale === 'nl' ? 'Toets verwijderen' : 'Delete Exam')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

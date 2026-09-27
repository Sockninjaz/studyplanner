'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import confetti from 'canvas-confetti';

interface StudySession {
  _id: string;
  title: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  isCompleted: boolean;
  checklist: Array<{ task: string; completed: boolean }>;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
  isCompleted?: boolean;
  studyMaterials?: Array<{
    chapter: string;
    book: string;
    difficulty: number;
    confidence: number;
    estimatedHours?: number;
    user_estimated_total_hours?: number;
    completed: boolean;
  }>;
  originalFileName?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ExamDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const { data: examData, error: examError, isLoading: examLoading, mutate: mutateExam } = useSWR(id ? `/api/exams/${id}` : null, fetcher);
  const { data: sessionsData, error: sessionsError, isLoading: sessionsLoading, mutate: mutateSessions } = useSWR(id ? `/api/sessions?examId=${id}` : null, fetcher);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);

  const exam: Exam | null = examData?.data || null;
  const sessions: StudySession[] = sessionsData?.data || [];

  const handleToggleCompletion = async () => {
    if (!exam || isTogglingCompletion) return;
    const targetStatus = !exam.isCompleted;
    setIsTogglingCompletion(true);

    // 1. Instant optimistic UI update (0ms latency)
    mutateExam(
      { ...examData, data: { ...exam, isCompleted: targetStatus } },
      false
    );

    if (targetStatus) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    try {
      const res = await fetch(`/api/exams/${exam._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: targetStatus })
      });

      if (!res.ok) throw new Error('Failed to update completion status');

      // Revalidate to sync fresh state
      await mutateExam();
      await mutateSessions();
      mutate('/api/exams');
      mutate('/api/calendar/events');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
    } catch (e) {
      console.error(e);
      // Revert on error
      mutateExam();
      alert('Failed to update completion status');
    } finally {
      setIsTogglingCompletion(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!exam) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/exams/${exam._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete exam');
      }

      mutate('/api/exams');
      
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('examDeleted', { detail: { examId: exam._id } });
        window.dispatchEvent(event);
      }
      
      router.push('/exams');
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Failed to delete exam');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (examError) return <div className="p-6 text-red-500">Failed to load exam details</div>;
  if (examLoading) return <div className="p-6 text-slate-500">Loading exam...</div>;
  if (!exam) return <div className="p-6 text-slate-500">Exam not found.</div>;

  const completedSessions = sessions.filter(s => s.isCompleted).length;
  const totalSessions = sessions.length;
  const progressPercentage = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link href="/exams" className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Exams
          </Link>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={`text-2xl md:text-3xl font-bold mb-1.5 ${exam.isCompleted ? 'text-slate-500 line-through' : 'text-gray-900 dark:text-slate-100'}`}>{exam.subject}</h1>
            <div className="text-gray-500 dark:text-slate-400 text-sm md:text-base" suppressHydrationWarning>
              Scheduled for {new Date(exam.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleToggleCompletion}
              disabled={isTogglingCompletion}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all duration-200 shadow-sm border ${
                exam.isCompleted 
                  ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30 active:scale-95' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95'
              }`}
            >
              {exam.isCompleted ? (
                <>
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Completed
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Mark as Done
                </>
              )}
            </button>
            <button
              onClick={() => router.push(`/exams/create?edit=${exam._id}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Exam
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors border border-red-100 dark:border-red-900/30 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2 text-base">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Progress Overview
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{completedSessions} of {totalSessions} sessions completed</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {exam.originalFileName && (
            <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-xl border border-purple-100 dark:border-purple-800/30 shadow-sm">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2 text-base">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Source Material
              </h3>
              <p className="text-purple-700 dark:text-purple-300 font-medium font-mono text-xs break-all">
                {exam.originalFileName}
              </p>
            </div>
          )}
        </div>

        {/* Main Content: Study Sessions */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Study Sessions</h3>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full">
              {sessions.length || 0} Sessions
            </span>
          </div>

          {sessionsLoading ? (
            <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700"></div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No study sessions planned yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sessions.map((session) => (
                <div key={session._id} className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/60 p-4 md:p-5 rounded-xl hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div>
                      <h4 className={`font-semibold text-base leading-tight mb-1.5 ${session.isCompleted ? 'text-slate-500 line-through' : 'text-gray-900 dark:text-slate-100'}`}>{session.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded-md" suppressHydrationWarning>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded-md" suppressHydrationWarning>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                      session.isCompleted 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {session.isCompleted ? 'Completed' : 'Scheduled'}
                    </span>
                  </div>
                  
                  {session.checklist && session.checklist.length > 0 && (
                    <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tasks</p>
                      <div className="space-y-2">
                        {session.checklist.map((item, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs">
                            <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              item.completed 
                                ? 'bg-green-500 border-green-500 text-white' 
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                            }`}>
                              {item.completed && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className={`leading-relaxed ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                              {item.task}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Delete Exam?</h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6 text-sm leading-relaxed">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{exam.subject}</strong>? This will permanently delete <strong className="text-gray-900 dark:text-white">{sessions.length}</strong> study sessions. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteExam}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Deleting...
                    </>
                  ) : 'Delete Exam'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

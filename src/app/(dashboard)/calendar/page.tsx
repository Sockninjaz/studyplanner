'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';

import Calendar from '@/components/calendar/calendar';
import CalendarListView from '@/components/calendar/calendar-list-view';
import AddItemModal from '@/components/calendar/add-item-modal';
import CreateTaskModal from '@/components/calendar/create-task-modal';
import TaskDetailModal from '@/components/calendar/task-detail-modal';
import { useSidebar } from '@/components/shared/sidebar-context';
import { useBlockedDays } from '@/hooks/use-calendar-data';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function CalendarPage() {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const { mutate } = useSWRConfig();
  const { isSidebarCollapsed } = useSidebar();
  const calendarRef = useRef<any>(null);
  const listViewRef = useRef<any>(null);
  const [currentMonthTitle, setCurrentMonthTitle] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTaskDetailModalOpen, setIsTaskDetailModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    if (typeof window === 'undefined') return 'calendar';
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    if (isPhone) return 'list';
    const savedMode = localStorage.getItem('calendarViewMode');
    return savedMode === 'list' || savedMode === 'calendar' ? savedMode : 'calendar';
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);
  const [isTodayInView, setIsTodayInView] = useState(true);
  const { blockedDays, mutate: mutateBlocked } = useBlockedDays();

  useEffect(() => {
    // Explicitly revalidate calendar events when navigating to Schedule
    mutate('/api/calendar/events');

    const handlePreferencesUpdated = () => {
      mutate('/api/calendar/events');
    };

    const handleCalendarUpdate = () => {
      mutate('/api/calendar/events');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('preferencesUpdated', handlePreferencesUpdated);
      window.addEventListener('calendarUpdated', handleCalendarUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('preferencesUpdated', handlePreferencesUpdated);
        window.removeEventListener('calendarUpdated', handleCalendarUpdate);
      }
    };
  }, [mutate]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      const timer = setTimeout(() => {
        calendarRef.current?.getApi?.()?.updateSize?.();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  const handleDatesSet = useCallback((info: any) => {
    if (info?.view?.title) {
      setCurrentMonthTitle((prev) => (prev === info.view.title ? prev : info.view.title));
    }
  }, []);

  const handlePrev = () => {
    if (calendarRef.current?.scrollToPrevMonth) {
      calendarRef.current.scrollToPrevMonth();
    } else {
      calendarRef.current?.getApi?.()?.prev?.();
    }
  };

  const handleNext = () => {
    if (calendarRef.current?.scrollToNextMonth) {
      calendarRef.current.scrollToNextMonth();
    } else {
      calendarRef.current?.getApi?.()?.next?.();
    }
  };

  const handleToday = () => {
    if (viewMode === 'calendar') {
      if (calendarRef.current?.scrollToToday) {
        calendarRef.current.scrollToToday();
      } else {
        calendarRef.current?.getApi?.()?.today?.();
      }
    } else {
      if (listViewRef.current?.scrollToToday) {
        listViewRef.current.scrollToToday();
      } else {
        const todayString = new Date().toDateString();
        const todayEl = document.getElementById(`date-${todayString}`);
        todayEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };



  const handleSessionClick = (sessionId: string, date?: string) => {
    const url = date ? `/today?session=${sessionId}&date=${date}` : `/today?session=${sessionId}`;
    router.push(url);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsTaskDetailModalOpen(true);
  };

  const handleAddItemClick = (date?: string, position?: { x: number; y: number }) => {
    let normalizedDate = new Date().toISOString().split('T')[0];

    if (date) {
      // Split and pad to ensure strict YYYY-MM-DD format (HTML date inputs will reject "2026-3-20")
      const parts = date.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
      }
    }

    setSelectedDate(normalizedDate);
    setDropdownPosition(position || null);
    setIsAddItemModalOpen(true);
  };

  const handleCloseExamModal = () => {
    setSelectedDate(undefined);
    setSelectedExamId(undefined);
    setSelectedExam(null);
  };

  const handleCloseAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setSelectedDate(undefined);
    setDropdownPosition(null);
  };

  const handleToggleBlock = async () => {
    if (!selectedDate || isTogglingBlock) return;
    setIsTogglingBlock(true);
    const dateToToggle = selectedDate;
    const isCurrentlyBlocked = blockedDays.has(dateToToggle);

    // Instant optimistic UI update (0ms feedback)
    const currentDates = Array.from(blockedDays);
    const nextDates = isCurrentlyBlocked
      ? currentDates.filter(x => x !== dateToToggle)
      : [...currentDates, dateToToggle];
    mutateBlocked({ data: nextDates }, false);
    setIsAddItemModalOpen(false);

    try {
      const res = await fetch('/api/blocked-days', {
        method: isCurrentlyBlocked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateToToggle }),
      });
      if (res.ok) {
        mutateBlocked();
        mutate('/api/calendar/events');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('calendarUpdated'));
        }
      } else {
        mutateBlocked();
      }
    } catch (err) {
      console.error('Failed to toggle block on day:', err);
      mutateBlocked();
    } finally {
      setIsTogglingBlock(false);
    }
  };

  const handleAddExam = () => {
    setIsAddItemModalOpen(false);
    if (selectedDate) {
      router.push(`/exams/create?date=${selectedDate}`);
    } else {
      router.push('/exams/create');
    }
  };

  const handleExamView = (examId: string) => {
    const mongoId = examId.replace('exam-', '');
    router.push(`/exams/${mongoId}`);
  };

  const handleExamEdit = (examId: string) => {
    const mongoId = examId.replace('exam-', '');
    router.push(`/exams/create?edit=${mongoId}`);
  };

  const handleAddTask = () => {
    setIsAddItemModalOpen(false);
    setIsTaskModalOpen(true);
  };

  const [showOverloadModal, setShowOverloadModal] = useState(false);

  const handleRegenerateSchedule = async () => {
    try {
      setIsRegenerating(true);
      const res = await fetch('/api/calendar/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      });
      if (!res.ok) throw new Error('Failed to check regeneration');

      const data = await res.json();
      if (data.requiresDecision) {
        setShowOverloadModal(true);
        setIsRegenerating(false);
        return;
      }
      
      // If no decision required, it fits safely. Run the actual save action.
      await submitRegenerateAction('compress');

    } catch (error) {
      console.error(error);
      alert('Error regenerating schedule');
      setIsRegenerating(false);
    }
  };

  const submitRegenerateAction = async (action: 'compress' | 'allowOverload') => {
    try {
      setIsRegenerating(true);
      setShowOverloadModal(false);
      const res = await fetch('/api/calendar/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      
      mutate('/api/calendar/events');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
      setIsRegenerating(false);
    } catch (error) {
      console.error(error);
      alert('Error saving schedule');
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-slate-900">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-row overflow-hidden">
          <div className="transition-all duration-300 flex flex-col w-full">
            {/* Toolbar — adapts for mobile and desktop */}
            <div className="bg-white dark:bg-slate-900 px-3 py-2 flex items-center justify-between h-14 flex-shrink-0 border-b border-gray-100 dark:border-slate-800">
              <h1 suppressHydrationWarning className="text-lg font-bold text-[#4a4a4a] dark:text-slate-100">
                {viewMode === 'calendar' ? currentMonthTitle : t('calendar.title')}
              </h1>

              <div className="flex items-center gap-2">
                {/* Calendar & List nav buttons */}
                <div suppressHydrationWarning className="flex items-center gap-1 mr-1">
                  {viewMode === 'calendar' && (
                    <div className="flex items-center gap-1">
                      <button onClick={handlePrev} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors text-[#4a4a4a] dark:text-slate-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button onClick={handleNext} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors text-[#4a4a4a] dark:text-slate-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleToday}
                    title={isTodayInView ? (locale === 'nl' ? "Vandaag is in beeld" : "Today is in view") : (locale === 'nl' ? "Scroll naar Vandaag" : "Scroll to Today")}
                    className={`ml-1 px-2.5 py-1 text-xs rounded transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      !isTodayInView
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 border border-indigo-600 shadow-sm shadow-indigo-600/30 font-semibold scale-[1.03] active:scale-95'
                        : 'border border-[#4a4a4a] border-opacity-20 dark:border-slate-700 text-[#4a4a4a] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    {!isTodayInView && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900 animate-pulse" />
                    )}
                    {t('common.today')}
                  </button>
                </div>

                {/* List/Calendar toggle – desktop & iPad */}
                <div suppressHydrationWarning className="hidden md:flex items-center bg-white dark:bg-slate-800 rounded-md p-0.5 border border-[#4a4a4a] border-opacity-20 shadow-sm">
                  <button
                    onClick={() => { setViewMode('list'); localStorage.setItem('calendarViewMode', 'list'); }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      viewMode === 'list' ? 'bg-indigo-600 text-white dark:text-slate-900 shadow-sm' : 'text-[#4a4a4a] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >{t('calendar.list')}</button>
                  <button
                    onClick={() => { setViewMode('calendar'); localStorage.setItem('calendarViewMode', 'calendar'); }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      viewMode === 'calendar' ? 'bg-indigo-600 text-white dark:text-slate-900 shadow-sm' : 'text-[#4a4a4a] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >{t('calendar.calendar')}</button>
                </div>

                {/* Regenerate – desktop & iPad (phones have FAB) */}
                <button
                  onClick={handleRegenerateSchedule}
                  disabled={isRegenerating}
                  title={locale === 'nl' ? 'Rooster herberekenen' : 'Regenerate schedule'}
                  className="hidden md:flex bg-white dark:bg-slate-800 border border-[#4a4a4a] border-opacity-20 text-[#4a4a4a] dark:text-slate-200 px-2.5 py-1 rounded text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors items-center gap-1.5 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRegenerating ? (locale === 'nl' ? 'Bezig...' : 'Regenerating...') : t('calendar.regenerate')}
                </button>

                {/* Add Exam – desktop & iPad (phones have FAB) */}
                <button
                  onClick={() => router.push('/exams/create')}
                  className="hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 px-3 py-1 rounded transition-colors items-center gap-1.5 shadow-sm text-xs font-medium border border-transparent"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('calendar.addExam')}
                </button>
              </div>
            </div>

            {/* Content - Stretches to fill everything */}
            <div suppressHydrationWarning className="flex-1 overflow-hidden relative">
              <div className={`h-full ${viewMode === 'list' ? 'block' : 'hidden'}`}>
                <CalendarListView
                  ref={listViewRef}
                  onSessionClick={handleSessionClick}
                  onTaskClick={handleTaskClick}
                  onAddItemClick={handleAddItemClick}
                  onExamView={handleExamView}
                  onExamEdit={handleExamEdit}
                  sidebarOpen={false}
                  sidebarCollapsed={isSidebarCollapsed}
                  onTodayInViewChange={viewMode === 'list' ? setIsTodayInView : undefined}
                />
              </div>
              <div className={`h-full absolute inset-0 ${viewMode === 'calendar' ? 'block' : 'hidden'}`}>
                <Calendar
                  ref={calendarRef}
                  onSessionClick={handleSessionClick}
                  onTaskClick={handleTaskClick}
                  onAddItemClick={handleAddItemClick}
                  sidebarOpen={false}
                  sidebarCollapsed={isSidebarCollapsed}
                  onDatesSet={handleDatesSet}
                  onTodayInViewChange={viewMode === 'calendar' ? setIsTodayInView : undefined}
                  blockedDays={blockedDays}
                />
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* ── Mobile FABs: Add Exam + Regenerate (phones only, above bottom nav) ── */}
      <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3">
        {/* Regenerate Schedule */}
        <button
          onClick={handleRegenerateSchedule}
          disabled={isRegenerating}
          title={locale === 'nl' ? 'Rooster herberekenen' : 'Regenerate schedule'}
          className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-lg rounded-2xl px-4 py-3 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
        >
          <svg className={`w-5 h-5 flex-shrink-0 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRegenerating ? (locale === 'nl' ? 'Bezig…' : 'Regenerating…') : t('calendar.regenerate')}
        </button>

        {/* Add Exam */}
        <button
          onClick={() => router.push('/exams/create')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 shadow-lg rounded-2xl px-5 py-3.5 font-semibold text-sm active:scale-95 transition-all border border-transparent"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('calendar.addExam')}
        </button>
      </div>

      {/* Add Item Dropdown */}
      <AddItemModal
        key={selectedDate || 'day-dropdown'}
        isOpen={isAddItemModalOpen}
        onClose={handleCloseAddItemModal}
        onAddExam={handleAddExam}
        onAddTask={handleAddTask}
        date={selectedDate}
        anchorPosition={dropdownPosition}
        isBlocked={selectedDate ? blockedDays.has(selectedDate) : false}
        onToggleBlock={handleToggleBlock}
        isTogglingBlock={isTogglingBlock}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskId(null);
          setSelectedDate(undefined);
        }}
        selectedDate={selectedDate}
        editingTaskId={selectedTaskId}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isTaskDetailModalOpen}
        onClose={() => {
          setIsTaskDetailModalOpen(false);
          setSelectedTaskId(null);
        }}
        taskId={selectedTaskId}
        onEdit={(taskId) => {
          setSelectedTaskId(taskId);
          setIsTaskDetailModalOpen(false);
          setIsTaskModalOpen(true);
        }}
      />

      {/* Exam Modal - View */}

      {/* Overload Decision Modal */}
      {showOverloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {locale === 'nl' ? 'Rooster Overbelasting Waarschuwing' : 'Schedule Overload Warning'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                {locale === 'nl'
                  ? 'Je resterende studiestof is te veel om in te plannen binnen je beschikbare dagen zonder je dagelijkse maximumlimiet te overschrijden. Hoe wil je de overbelasting aanpakken?'
                  : 'Your remaining study material is too dense to fit into your available days without exceeding your daily maximum limit. How would you like to handle the overflow?'}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => submitRegenerateAction('compress')}
                  disabled={isRegenerating}
                  className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">
                      {locale === 'nl' ? 'Hoofdstukken Comprimeren' : 'Compress Chapters to Fit'}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {locale === 'nl'
                        ? 'Sessies boven je daglimiet worden samengevoegd tot combinaties (bijv. "Hoofdstuk 5 & Hoofdstuk 6") met iets minder diepgang.'
                        : 'Sessions over your daily limit are merged into combined topics (e.g. "Chapter 5 & Chapter 6") at the cost of less in-depth coverage.'}
                    </div>
                  </div>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                <button
                  onClick={() => submitRegenerateAction('allowOverload')}
                  disabled={isRegenerating}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div>
                    <div className="font-bold">
                      {locale === 'nl' ? 'Alle Sessies Behouden' : 'Keep All Sessions'}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {locale === 'nl'
                        ? 'Plaats toch alle sessies, waarbij je dagelijkse maximum overschreden mag worden.'
                        : 'Place all sessions anyway, allowing your schedule to exceed the daily limit.'}
                    </div>
                  </div>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setShowOverloadModal(false)}
                disabled={isRegenerating}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}


'use client';

import { useState, useEffect, useRef } from 'react';
import Calendar from '@/components/calendar/calendar';
import CalendarListView from '@/components/calendar/calendar-list-view';
import SessionSidebar from '@/components/calendar/session-sidebar';
import TaskSidebar from '@/components/calendar/task-sidebar';
import CreateExamModal from '@/components/exams/create-exam-modal';
import ExamModal from '@/components/exams/exam-modal';
import EditExamModal from '@/components/exams/edit-exam-modal';
import AddItemModal from '@/components/calendar/add-item-modal';
import CreateTaskModal from '@/components/calendar/create-task-modal';
import { useSidebar } from '@/components/shared/sidebar-context';
import { isValidCalendarDate } from '@/lib/dateUtils';

interface UserPreferences {
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

export default function CalendarPage() {
  const { isSidebarCollapsed } = useSidebar();
  const calendarRef = useRef<any>(null);
  const [currentMonthTitle, setCurrentMonthTitle] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    fetchUserPreferences();
  }, []);

  const handleDatesSet = (info: any) => {
    // Info contains view.title which is the month name (e.g. "February 2026")
    setCurrentMonthTitle(info.view.title);
  };

  const handlePrev = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNext = () => {
    calendarRef.current?.getApi().next();
  };

  const handleToday = () => {
    calendarRef.current?.getApi().today();
  };

  const fetchUserPreferences = async () => {
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          setUserPreferences(prefs);
        } catch (error) {
          console.error('Error parsing localStorage preferences:', error);
        }
      }
      const res = await fetch('/api/user/preferences');
      if (res.ok) {
        const data = await res.json();
        const serverPrefs = {
          daily_study_limit: data.daily_study_limit || 4,
          soft_daily_limit: data.soft_daily_limit || 2,
          adjustment_percentage: data.adjustment_percentage || 25,
          session_duration: data.session_duration || 30,
          enable_daily_limits: data.enable_daily_limits !== false,
        };
        if (!savedPrefs) {
          setUserPreferences(serverPrefs);
          localStorage.setItem('userPreferences', JSON.stringify(serverPrefs));
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSelectedTaskId(null);
    setIsSidebarOpen(true);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSelectedSessionId(null);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedSessionId(null);
    setSelectedTaskId(null);
  };

  const handleAddItemClick = (date: string) => {
    if (!isValidCalendarDate(date)) {
      alert('The selected date is invalid for this year (e.g. Feb 29th on a non-leap year). Please select a valid date.');
      return;
    }
    setSelectedDate(date);
    setIsAddItemModalOpen(true);
  };

  const handleCloseExamModal = () => {
    setIsExamModalOpen(false);
    setSelectedDate(undefined);
    setSelectedExamId(undefined);
    setSelectedExam(null);
  };

  const handleCloseAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setSelectedDate(undefined);
  };

  const handleAddExam = () => {
    setIsAddItemModalOpen(false);
    setIsExamModalOpen(true);
  };

  const handleExamView = async (examId: string) => {
    try {
      const mongoId = examId.replace('exam-', '');
      const response = await fetch(`/api/exams/${mongoId}`);
      if (response.ok) {
        const examData = await response.json();
        setSelectedExam(examData.data);
        setSelectedExamId(examId);
        setIsExamModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch exam:', error);
    }
  };

  const handleExamEdit = async (examId: string) => {
    try {
      const mongoId = examId.replace('exam-', '');
      const response = await fetch(`/api/exams/${mongoId}`);
      if (response.ok) {
        const examData = await response.json();
        setSelectedExam(examData.data);
        setSelectedExamId(examId);
        setIsEditExamModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch exam:', error);
    }
  };

  const handleCloseEditExamModal = () => {
    setIsEditExamModalOpen(false);
    setSelectedExam(null);
    setSelectedExamId(undefined);
  };

  const handleAddTask = () => {
    setIsAddItemModalOpen(false);
    setIsTaskModalOpen(true);
  };

  const handleRegenerateSchedule = async () => {
    try {
      setIsRegenerating(true);
      const res = await fetch('/api/calendar/regenerate', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to regenerate');

      const data = await res.json();
      if (data.overloadWarning) {
        alert("Schedule regenerated, but " + data.overloadWarning);
      }

      // Refresh the page to show the new schedule
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Error regenerating schedule');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-white">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-row overflow-hidden">
          <div className={`transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-[60%]' : 'w-full'}`}>
            {/* View Toggle and Header - Clean, no borders */}
            <div className="bg-[#ffff] px-4 py-3 flex items-center justify-between h-16 flex-shrink-0">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-[#4a4a4a]">
                  {viewMode === 'calendar' ? currentMonthTitle : viewMode === 'list' ? 'Schedule' : 'Calendar'}
                </h1>
              </div>
              <div className="flex items-center gap-4">
                {viewMode === 'calendar' && (
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded transition-colors text-[#4a4a4a]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button onClick={handleNext} className="p-1 hover:bg-gray-100 rounded transition-colors text-[#4a4a4a]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button onClick={handleToday} className="ml-2 px-3 py-1 text-sm font-medium border border-[#4a4a4a] border-opacity-20 rounded hover:bg-gray-50 transition-colors text-[#4a4a4a]">
                      Today
                    </button>
                  </div>
                )}
                <div className="flex items-center bg-white rounded-lg p-1 border border-[#4a4a4a] border-opacity-20 shadow-sm">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list'
                      ? 'bg-[rgb(40,57,135)] text-white shadow-sm'
                      : 'text-[#4a4a4a] hover:bg-gray-50 hover:text-[#4a4a4a]'
                      }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'calendar'
                      ? 'bg-[rgb(40,57,135)] text-white shadow-sm'
                      : 'text-[#4a4a4a] hover:bg-gray-50 hover:text-[#4a4a4a]'
                      }`}
                  >
                    Calendar
                  </button>
                </div>
                <button
                  onClick={handleRegenerateSchedule}
                  disabled={isRegenerating}
                  title="Regenerate planner based on current preferences"
                  className="bg-white border border-[#4a4a4a] border-opacity-20 text-[#4a4a4a] px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="bg-[rgb(54,65,86)] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2 shadow-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {viewMode === 'calendar' ? 'New' : 'Add Exam'}
                </button>
              </div>
            </div>

            {/* Content - Stretches to fill everything */}
            <div className="flex-1 overflow-hidden relative">
              {viewMode === 'list' ? (
                <div className="h-full overflow-y-auto">
                  <CalendarListView
                    onSessionClick={handleSessionClick}
                    onTaskClick={handleTaskClick}
                    onAddItemClick={handleAddItemClick}
                    onExamView={handleExamView}
                    onExamEdit={handleExamEdit}
                    sidebarOpen={isSidebarOpen}
                    sidebarCollapsed={isSidebarCollapsed}
                  />
                </div>
              ) : (
                <div className="h-full absolute inset-0">
                  <Calendar
                    ref={calendarRef}
                    onSessionClick={handleSessionClick}
                    onAddItemClick={handleAddItemClick}
                    sidebarOpen={isSidebarOpen}
                    sidebarCollapsed={isSidebarCollapsed}
                    onDatesSet={handleDatesSet}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Session or Task */}
          {isSidebarOpen && (
            <div className="w-[40%] transition-all duration-300 flex flex-col border-l border-gray-200 bg-white">
              <div className="flex-1 overflow-hidden">
                {selectedSessionId ? (
                  <SessionSidebar
                    sessionId={selectedSessionId}
                    onClose={handleCloseSidebar}
                  />
                ) : selectedTaskId ? (
                  <TaskSidebar
                    taskId={selectedTaskId}
                    onClose={handleCloseSidebar}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={handleCloseAddItemModal}
        onAddExam={handleAddExam}
        onAddTask={handleAddTask}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedDate(undefined);
        }}
        selectedDate={selectedDate}
      />

      {/* Exam Modal - View */}
      {selectedExam && isExamModalOpen && (
        <ExamModal
          exam={selectedExam}
          isOpen={isExamModalOpen}
          onClose={handleCloseExamModal}
        />
      )}

      {/* Edit Exam Modal */}
      {selectedExam && isEditExamModalOpen && (
        <EditExamModal
          exam={selectedExam}
          isOpen={isEditExamModalOpen}
          onClose={handleCloseEditExamModal}
        />
      )}

      {/* Create Exam Modal */}
      {!selectedExam && (
        <CreateExamModal
          isOpen={isExamModalOpen}
          onClose={handleCloseExamModal}
          dailyMaxHours={userPreferences.daily_study_limit}
          adjustmentPercentage={userPreferences.adjustment_percentage}
          sessionDuration={userPreferences.session_duration}
          enableDailyLimits={userPreferences.enable_daily_limits}
          initialDate={selectedDate}
        />
      )}
    </>
  );
}


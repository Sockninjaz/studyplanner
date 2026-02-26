'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import ExamModal from '@/components/exams/exam-modal';
import CreateExamModal from '@/components/exams/create-exam-modal';

interface UserPreferences {
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
  color?: string;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ isCollapsed = false, onToggle }: SidebarProps) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });

  useEffect(() => {
    fetchExams();
    fetchPreferences();

    // Listen for exam deletion events
    const handleExamDeleted = () => {
      fetchExams();
    };

    // Listen for preference updates
    const handlePreferencesUpdated = () => {
      fetchPreferences();
    };

    // Listen for calendar updates (when exams are created)
    const handleCalendarUpdated = () => {
      fetchExams();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('examDeleted', handleExamDeleted);
      window.addEventListener('preferencesUpdated', handlePreferencesUpdated);
      window.addEventListener('calendarUpdated', handleCalendarUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('examDeleted', handleExamDeleted);
        window.removeEventListener('preferencesUpdated', handlePreferencesUpdated);
        window.removeEventListener('calendarUpdated', handleCalendarUpdated);
      }
    };
  }, []);

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/exams');
      if (response.ok) {
        const data = await response.json();
        setExams(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        setUserPreferences(prefs);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const openExamModal = (exam: Exam) => {
    setSelectedExam(exam);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedExam(null);
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    // Refresh exams list after creating a new one
    fetchExams();
  };

  const handleDeleteExam = async (examId: string) => {
    if (window.confirm('Are you sure you want to delete this exam and all its study sessions?')) {
      try {
        const res = await fetch(`/api/exams/${examId}`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete exam');
        }

        // Refresh the exam list
        fetchExams();

        // Dispatch a custom event to notify other components like the calendar
        window.dispatchEvent(new CustomEvent('examDeleted'));

      } catch (error) {
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete exam'}`);
      }
    }
  };

  return (
    <>
      <aside
        className={`absolute left-0 top-0 z-20 flex h-screen overflow-y-hidden text-white duration-300 ease-linear lg:static lg:translate-x-0 ${isCollapsed ? 'w-16' : 'w-72'
          } flex-col`}
        style={{ backgroundColor: 'rgb(54, 65, 86)' }}
      >
        <div className={`flex items-center justify-between gap-2 ${isCollapsed ? 'px-2 py-4' : 'px-6 py-5 lg:py-6'
          }`}>
          {!isCollapsed && (
            <Link href="/">
            </Link>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-white hover:bg-white hover:bg-opacity-10 p-2 rounded-lg transition-colors flex-shrink-0"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          )}
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className={`mt-5 py-4 ${isCollapsed ? 'px-1' : 'px-4'} lg:mt-9 lg:px-6`}>
            {!isCollapsed && (
              <div>
                <ul className="mb-6 flex flex-col gap-0.5">
                  <li>
                    <Link href="/calendar" className="group relative flex items-center gap-3 rounded-md py-2 px-3 font-medium text-[15px] text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      <svg className="w-[18px] h-[18px] opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Schedule
                    </Link>
                  </li>
                  <li>
                    <Link href="/today" className="group relative flex items-center gap-3 rounded-md py-2 px-3 font-medium text-[15px] text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      <svg className="w-[18px] h-[18px] opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      Today
                    </Link>
                  </li>
                  <li>
                    <Link href="/exams" className="group relative flex items-center gap-3 rounded-md py-2 px-3 font-medium text-[15px] text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      <svg className="w-[18px] h-[18px] opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                      </svg>
                      Exams
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {isCollapsed && (
              <div className="space-y-1">
                <Link href="/calendar" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="Schedule">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Link>
                <Link href="/today" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="Today">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
                <Link href="/exams" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="Exams">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
                  </svg>
                </Link>
              </div>
            )}

            {!isCollapsed && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-2 px-3 group/header cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-400">My Exams</h3>
                  <button
                    onClick={openCreateModal}
                    className="text-gray-400 hover:text-white p-1 rounded-md transition-colors opacity-0 group-hover/header:opacity-100 flex items-center justify-center"
                    title="Add Exam"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <ul className="mb-6 flex flex-col gap-0.5">
                  {loading ? (
                    <li className="px-4 py-3 text-base text-white opacity-60">Loading exams...</li>
                  ) : exams.length === 0 ? (
                    <li className="px-4 py-3 text-base text-white opacity-60">No exams scheduled</li>
                  ) : (
                    exams.map((exam, index) => {
                      // Use stored color or stable fallback
                      const getExamColor = (exam: Exam) => {
                        if (exam.color) return exam.color;

                        const colors = [
                          'rgb(253, 231, 76)', // Yellow
                          'rgb(72, 86, 150)',  // Blue  
                          'rgb(250, 175, 205)', // Pink
                          'rgb(66, 191, 221)',  // Cyan
                          'rgb(167, 139, 250)', // Lavender
                          'rgb(52, 211, 153)',  // Mint
                          'rgb(251, 146, 60)',  // Orange/Peach
                          'rgb(45, 212, 191)',  // Teal
                        ];

                        // Stable ID-based fallback
                        // Use a simple hash function (djb2-like) for better distribution than simple sum
                        let hash = 0;
                        const str = exam._id;
                        for (let i = 0; i < str.length; i++) {
                          hash = ((hash << 5) - hash) + str.charCodeAt(i);
                          hash |= 0; // Convert to 32bit integer
                        }
                        return colors[Math.abs(hash) % colors.length];
                      };

                      const examColor = getExamColor(exam);

                      return (
                        <li key={exam._id}>
                          <div className="w-full group relative flex items-center rounded-md font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                            <button
                              onClick={() => openExamModal(exam)}
                              className="flex-1 flex items-center gap-3 py-2 px-3 text-left min-w-0 overflow-hidden"
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: examColor }}
                              />
                              <span className="text-[15px] truncate min-w-0" title={exam.subject}>
                                {exam.subject}
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening the modal
                                handleDeleteExam(exam._id);
                              }}
                              className="px-2 py-1.5 text-gray-400 hover:text-red-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`Delete ${exam.subject}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </nav>
        </div>
      </aside>

      <ExamModal
        exam={selectedExam}
        isOpen={isModalOpen}
        onClose={closeModal}
      />

      <CreateExamModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        dailyMaxHours={userPreferences.daily_study_limit}
        adjustmentPercentage={userPreferences.adjustment_percentage}
        sessionDuration={userPreferences.session_duration}
        enableDailyLimits={userPreferences.enable_daily_limits}
      />
    </>
  );
};

export default Sidebar;

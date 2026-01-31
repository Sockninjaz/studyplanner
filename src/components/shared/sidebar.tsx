'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import ExamModal from '@/components/exams/exam-modal';
import CreateExamModal from '@/components/exams/create-exam-modal';

interface UserPreferences {
  daily_study_limit: number;
  adjustment_percentage: number;
  session_duration: number;
}

interface Exam {
  _id: string;
  subject: string;
  date: Date;
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
    adjustment_percentage: 25,
    session_duration: 30,
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
        className={`absolute left-0 top-0 z-20 flex h-screen overflow-y-hidden text-white duration-300 ease-linear lg:static lg:translate-x-0 ${
          isCollapsed ? 'w-16' : 'w-72'
        } flex-col`}
        style={{ backgroundColor: 'rgb(54, 65, 86)' }}
      >
        <div className={`flex items-center justify-between gap-2 ${
          isCollapsed ? 'px-2 py-4' : 'px-6 py-5 lg:py-6'
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
                <h3 className="mb-4 ml-4 text-sm font-semibold text-gray-400">MENU</h3>
                <ul className="mb-6 flex flex-col gap-1.5">
                  <li>
                    <Link href="/calendar" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      Calendar
                    </Link>
                  </li>
                  <li>
                    <Link href="/exams" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      Exams
                    </Link>
                  </li>
                  <li>
                    <Link href="/session" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                      New Session
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {isCollapsed && (
              <div className="space-y-1">
                <Link href="/calendar" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="Calendar">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Link>
                <Link href="/exams" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="Exams">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
                  </svg>
                </Link>
                <Link href="/session" className="flex justify-center py-3 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors" title="New Session">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Link>
              </div>
            )}

            {!isCollapsed && (
              <div>
                <div className="flex items-center justify-between mb-6 px-4">
                  <h3 className="mb-4 ml-4 text-lg font-semibold text-white opacity-70">MY EXAMS</h3>
                  <button
                    onClick={openCreateModal}
                    className="bg-[rgb(40,57,135)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors"
                  >
                    + Add
                  </button>
                </div>
                <ul className="mb-6 flex flex-col gap-2">
                  {loading ? (
                    <li className="px-4 py-3 text-base text-white opacity-60">Loading exams...</li>
                  ) : exams.length === 0 ? (
                    <li className="px-4 py-3 text-base text-white opacity-60">No exams scheduled</li>
                  ) : (
                    exams.map((exam, index) => {
                      // Color assignment logic - same as calendar list view
                      const getExamColor = (subject: string, examIndex: number) => {
                        const colors = [
                          'rgb(253, 231, 76)', // Yellow
                          'rgb(72, 86, 150)',  // Blue  
                          'rgb(250, 175, 205)', // Pink
                          'rgb(66, 191, 221)',  // Cyan
                        ];
                        return colors[examIndex % colors.length];
                      };
                      
                      const examColor = getExamColor(exam.subject, index);
                      
                      return (
                        <li key={exam._id}>
                          <div className="w-full group relative flex items-center gap-3 rounded-lg font-medium text-white duration-300 ease-in-out hover:bg-white hover:bg-opacity-10">
                            <button
                              onClick={() => openExamModal(exam)}
                              className="flex-1 flex items-center gap-3 py-3 px-4 text-left"
                            >
                              <div 
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: examColor }}
                              />
                              <span className="flex-1 text-base">{exam.subject}</span>
                              <span className="text-sm text-white opacity-60">
                                {new Date(exam.date).toLocaleDateString()}
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening the modal
                                handleDeleteExam(exam._id);
                              }}
                              className="px-3 py-3 text-red-400 hover:text-red-300"
                              aria-label={`Delete ${exam.subject}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
      />
    </>
  );
};

export default Sidebar;

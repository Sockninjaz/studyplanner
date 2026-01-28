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

const Sidebar = () => {
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
    
    if (typeof window !== 'undefined') {
      window.addEventListener('examDeleted', handleExamDeleted);
      window.addEventListener('preferencesUpdated', handlePreferencesUpdated);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('examDeleted', handleExamDeleted);
        window.removeEventListener('preferencesUpdated', handlePreferencesUpdated);
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
      <aside className="absolute left-0 top-0 z-20 flex h-screen w-72 flex-col overflow-y-hidden bg-gray-800 text-white duration-300 ease-linear lg:static lg:translate-x-0">
        <div className="flex items-center justify-between gap-2 px-6 py-5 lg:py-6">
          <Link href="/">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </Link>
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
            <div>
              <h3 className="mb-4 ml-4 text-sm font-semibold text-gray-400">MENU</h3>
              <ul className="mb-6 flex flex-col gap-1.5">
                <li>
                  <Link href="/calendar" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                    Calendar
                  </Link>
                </li>
                <li>
                  <Link href="/exams" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                    Exams
                  </Link>
                </li>
                <li>
                  <Link href="/session" className="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                    New Session
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 px-4">
                <h3 className="text-sm font-semibold text-gray-400">MY EXAMS</h3>
                <button
                  onClick={openCreateModal}
                  className="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-700 transition-colors"
                >
                  + Add
                </button>
              </div>
              <ul className="mb-6 flex flex-col gap-1.5">
                {loading ? (
                  <li className="px-4 py-2 text-sm text-gray-400">Loading exams...</li>
                ) : exams.length === 0 ? (
                  <li className="px-4 py-2 text-sm text-gray-400">No exams scheduled</li>
                ) : (
                  exams.map((exam) => (
                    <li key={exam._id}>
                      <div className="w-full group relative flex items-center gap-2.5 rounded-sm font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700">
                        <button
                          onClick={() => openExamModal(exam)}
                          className="flex-1 flex items-center gap-2.5 py-2 px-4 text-left"
                        >
                          <span className="flex-1">{exam.subject}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(exam.date).toLocaleDateString()}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent opening the modal
                            handleDeleteExam(exam._id);
                          }}
                          className="px-3 py-2 text-red-500 hover:text-red-400"
                          aria-label={`Delete ${exam.subject}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
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

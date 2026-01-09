'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import ExamModal from '@/components/exams/exam-modal';
import CreateExamModal from '@/components/exams/create-exam-modal';

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

  useEffect(() => {
    fetchExams();
    
    // Listen for exam deletion events
    const handleExamDeleted = () => {
      fetchExams();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('examDeleted', handleExamDeleted);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('examDeleted', handleExamDeleted);
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
                      <button
                        onClick={() => openExamModal(exam)}
                        className="w-full group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-gray-300 duration-300 ease-in-out hover:bg-gray-700 text-left"
                      >
                        <span className="flex-1">{exam.subject}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(exam.date).toLocaleDateString()}
                        </span>
                      </button>
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
      />
    </>
  );
};

export default Sidebar;

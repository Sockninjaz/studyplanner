'use client';

import ExamList from '@/components/exams/exam-list';
import CreateExamModal from '@/components/exams/create-exam-modal';
import { useState } from 'react';

export default function ExamsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Exams</h1>
        <button
          onClick={openModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Exam
        </button>
      </div>
      <ExamList />
      <CreateExamModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}


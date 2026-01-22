'use client';

import ExamList from '@/components/exams/exam-list';
import CreateExamModal from '@/components/exams/create-exam-modal';
import { useState, useEffect } from 'react';

export default function ExamsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dailyMaxHours, setDailyMaxHours] = useState(4);

  // Load and save dailyMaxHours from/to localStorage
  useEffect(() => {
    const savedHours = localStorage.getItem('dailyMaxHours');
    if (savedHours) {
      setDailyMaxHours(parseInt(savedHours, 10));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('dailyMaxHours', dailyMaxHours.toString());
  }, [dailyMaxHours]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Exams</h1>
        <div className="flex items-center gap-4">
          <div>
            <label htmlFor="daily-max-hours" className="block text-sm font-medium text-gray-700">
              Daily Study Cap (Hours)
            </label>
            <input
              type="number"
              id="daily-max-hours"
              name="daily-max-hours"
              min="1"
              max="12"
              value={dailyMaxHours}
              onChange={(e) => setDailyMaxHours(parseInt(e.target.value, 10) || 1)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={openModal}
            className="self-end bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Add Exam
          </button>
        </div>
      </div>
      <ExamList />
      <CreateExamModal isOpen={isModalOpen} onClose={closeModal} dailyMaxHours={dailyMaxHours} />
    </div>
  );
}


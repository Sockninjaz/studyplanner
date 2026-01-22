'use client';

import ExamList from '@/components/exams/exam-list';
import CreateExamModal from '@/components/exams/create-exam-modal';
import UserPreferences from '@/components/user/user-preferences';
import { useState, useEffect } from 'react';

interface UserPreferences {
  daily_study_limit: number;
  adjustment_percentage: number;
  session_duration: number;
}

export default function ExamsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    adjustment_percentage: 25,
    session_duration: 30,
  });

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
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExamList />
        </div>
        <div className="lg:col-span-1">
          <UserPreferences onPreferencesChange={setUserPreferences} />
        </div>
      </div>
      
      <CreateExamModal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        dailyMaxHours={userPreferences.daily_study_limit}
        adjustmentPercentage={userPreferences.adjustment_percentage}
        sessionDuration={userPreferences.session_duration}
      />
    </div>
  );
}


'use client';

import ExamList from '@/components/exams/exam-list';
import UserPreferences from '@/components/user/user-preferences';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserPreferences {
  daily_study_limit: number;
  soft_daily_limit: number;
  adjustment_percentage: number;
  session_duration: number;
  enable_daily_limits: boolean;
}

export default function ExamsPage() {
  const router = useRouter();
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    daily_study_limit: 4,
    soft_daily_limit: 2,
    adjustment_percentage: 25,
    session_duration: 30,
    enable_daily_limits: true,
  });

  const handleAddExam = () => router.push('/exams/create');

  return (
    <div className="p-4 md:p-6 2xl:p-10 max-w-screen-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Exams</h1>
        <button
          onClick={handleAddExam}
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
    </div>
  );
}


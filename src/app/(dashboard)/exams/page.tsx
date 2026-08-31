'use client';

import ExamList from '@/components/exams/exam-list';
import { useRouter } from 'next/navigation';

export default function ExamsPage() {
  const router = useRouter();

  const handleAddExam = () => router.push('/exams/create');

  return (
    <div className="p-4 md:p-6 2xl:p-10 max-w-screen-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Exams</h1>
        <button
          onClick={handleAddExam}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          + Add Exam
        </button>
      </div>

      <div className="w-full">
        <ExamList />
      </div>
    </div>
  );
}


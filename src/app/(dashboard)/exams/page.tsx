'use client';

import ExamList from '@/components/exams/exam-list';
import { useRouter } from 'next/navigation';

export default function ExamsPage() {
  const router = useRouter();

  const handleAddExam = () => router.push('/exams/create');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900">
      <div className="p-4 md:p-6 2xl:p-10 max-w-screen-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Exams</h1>
          <button
            onClick={handleAddExam}
            className="bg-indigo-600 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm md:text-base"
          >
            + Add Exam
          </button>
        </div>

        <div className="w-full">
          <ExamList />
        </div>
      </div>
    </div>
  );
}


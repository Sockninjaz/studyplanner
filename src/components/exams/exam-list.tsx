'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ExamList() {
  const { data, error, isLoading } = useSWR('/api/exams', fetcher);

  if (error) return <div>Failed to load exams</div>;
  if (isLoading) return <div>Loading...</div>;
  if (!data || !data.data || data.data.length === 0) return <div>No exams found.</div>;

  const calculateProgress = (materials: any[]) => {
    if (!materials || materials.length === 0) return 0;
    const completed = materials.filter((m) => m.completed).length;
    return Math.round((completed / materials.length) * 100);
  };

  return (
    <div className="mt-8 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md">
      <h2 className="mb-4 text-xl font-bold dark:text-slate-100">Your Exams</h2>
      <ul className="divide-y divide-gray-200 dark:divide-slate-700">
        {data.data.map((exam: any) => {
          const progress = calculateProgress(exam.studyMaterials);
          return (
            <li key={exam._id} className="py-4 hover:bg-gray-50 dark:hover:bg-slate-800">
              <Link href={`/exams/${exam._id}`} className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold dark:text-slate-100">{exam.title}</h3>
                    <p className="text-gray-600 dark:text-slate-400">{exam.subject}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {new Date(exam.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold dark:text-slate-100">{progress}%</span>
                  </div>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200 dark:bg-slate-700">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

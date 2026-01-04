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
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-bold">Your Exams</h2>
      <ul className="divide-y divide-gray-200">
        {data.data.map((exam: any) => {
          const progress = calculateProgress(exam.studyMaterials);
          return (
            <li key={exam._id} className="py-4 hover:bg-gray-50">
              <Link href={`/exams/${exam._id}`} className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{exam.title}</h3>
                    <p className="text-gray-600">{exam.subject}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(exam.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{progress}%</span>
                  </div>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2.5 rounded-full bg-blue-600"
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

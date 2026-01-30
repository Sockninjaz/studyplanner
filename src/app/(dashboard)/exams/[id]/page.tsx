'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import StudyMaterialForm from '@/components/exams/study-material-form';
import StudyMaterialList from '@/components/exams/study-material-list';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ExamDetailPage() {
  const { id } = useParams();
  const { data, error, isLoading } = useSWR(id ? `/api/exams/${id}` : null, fetcher);

  if (error) return <div>Failed to load exam details</div>;
  if (isLoading) return <div>Loading...</div>;
  if (!data || !data.data) return <div>Exam not found.</div>;

  const { title, subject, date, description, studyMaterials } = data.data;

  return (
    <div>
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-md">
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-2 text-lg text-gray-700">{subject}</p>
        <p className="mb-4 text-sm text-gray-500">
          Exam Date: {new Date(date).toLocaleDateString()}
        </p>
        <p className="text-gray-600">{description}</p>
      </div>

      <StudyMaterialForm examId={id as string} />
      <StudyMaterialList materials={studyMaterials} />
    </div>
  );
}

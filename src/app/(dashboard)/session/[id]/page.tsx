'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Timer from '@/components/session/timer';
import StudyItemChecklist from '@/components/session/study-item-checklist';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SessionExecutionPage() {
  const { id } = useParams();
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/sessions/${id}` : null,
    fetcher
  );

  const handleSessionComplete = async () => {
    await fetch(`/api/sessions/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', actualEndTime: new Date() }),
      }
    );
    mutate();
  };

  if (error) return <div>Failed to load session</div>;
  if (isLoading) return <div>Loading...</div>;
  if (!data || !data.data) return <div>Session not found.</div>;

  const { title, duration, studyItems, status } = data.data;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <h1 className="mb-2 text-3xl font-bold text-center">{title}</h1>
      {status === 'completed' ? (
        <div className="text-center text-2xl font-semibold text-green-600 mt-8">
          Session Completed!
        </div>
      ) : (
        <>
          <Timer duration={duration} onComplete={handleSessionComplete} />
          <StudyItemChecklist sessionId={id as string} items={studyItems} />
        </>
      )}
    </div>
  );
}

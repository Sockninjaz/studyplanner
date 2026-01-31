'use client';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Timer from '@/components/session/timer';
import StudyItemChecklist from '@/components/session/study-item-checklist';
import StudyMaterialsDisplay from '@/components/session/study-materials-display';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SessionExecutionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/sessions/${id}` : null,
    fetcher
  );

  const handleSessionComplete = async () => {
    await fetch(`/api/sessions/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      }
    );
    mutate();
  };

  if (error) return <div>Failed to load session</div>;
  if (isLoading) return <div>Loading...</div>;
  if (!data || !data.data) return <div>Session not found.</div>;

  const session = data.data;
  
  // Calculate duration from startTime and endTime
  const duration = session.startTime && session.endTime 
    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
    : 60; // Default to 60 minutes

  const handleToggleComplete = async () => {
    await fetch(`/api/sessions/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !session.isCompleted }),
      }
    );
    mutate();
    
    // Trigger calendar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <div className="flex items-center mb-4">
        <button
          onClick={() => router.back()}
          className="mr-4 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-center">{session.title}</h1>
          <p className="text-center text-gray-600">{session.subject}</p>
        </div>
      </div>
      
      <div className="flex justify-center mb-6">
        <label className="flex items-center cursor-pointer bg-gray-100 rounded-lg px-4 py-2 hover:bg-gray-200 transition-colors">
          <input
            type="checkbox"
            checked={session.isCompleted || false}
            onChange={handleToggleComplete}
            className="mr-2 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-lg font-medium">
            {session.isCompleted ? 'Completed' : 'Mark as completed'}
          </span>
        </label>
      </div>
      
      {session.isCompleted ? (
        <div className="text-center text-2xl font-semibold text-green-600 mt-8">
          Session Completed!
        </div>
      ) : (
        <>
          <Timer duration={duration} onComplete={handleSessionComplete} sessionId={id as string} session={session} />
          <StudyItemChecklist sessionId={id as string} items={session.checklist || []} />
          <StudyMaterialsDisplay exam={session.exam || null} />
        </>
      )}
    </div>
  );
}

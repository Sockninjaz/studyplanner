'use client';

import { useState } from 'react';

interface Session {
  title: string;
  material: string;
  scheduledDate: string;
  duration: number;
}

interface Props {
  examId: string;
}

export default function StudyPlan({ examId }: Props) {
  const [plan, setPlan] = useState<Session[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generatePlan = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/plan`);
      if (!res.ok) {
        throw new Error('Failed to generate plan');
      }
      const data = await res.json();
      setPlan(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={generatePlan}
        disabled={isLoading}
        className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? 'Generating...' : 'Generate Study Plan'}
      </button>

      {plan && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow-md">
          <h2 className="border-b border-gray-200 p-6 text-xl font-bold">
            Generated Study Plan
          </h2>
          <ul className="divide-y divide-gray-200">
            {plan.map((session, index) => (
              <li key={index} className="p-6">
                <h3 className="font-semibold">{session.title}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(session.scheduledDate).toLocaleDateString()} - {session.duration} minutes
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

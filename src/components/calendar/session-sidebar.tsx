'use client';

import { useEffect, useState } from 'react';
import { mutate } from 'swr';
import Timer from '@/components/session/timer';
import NotesSection from '@/components/session/notes-section';
import StudyMaterialsDisplay from '@/components/session/study-materials-display';

interface SessionSidebarProps {
  sessionId: string | null;
  onClose: () => void;
}

export default function SessionSidebar({ sessionId, onClose }: SessionSidebarProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }

    const fetchSession = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        const data = await response.json();
        setSession(data.data);
      } catch (err) {
        setError('Failed to load session');
        console.error('Error fetching session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const handleSessionComplete = async () => {
    if (!sessionId) return;
    
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: true }),
    });
    
    // Refresh session data
    const response = await fetch(`/api/sessions/${sessionId}`);
    const data = await response.json();
    setSession(data.data);
    
    // Trigger calendar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
  };

  const handleToggleComplete = async () => {
    if (!sessionId || !session) return;
    
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: !session.isCompleted }),
    });
    
    // Refresh session data
    const response = await fetch(`/api/sessions/${sessionId}`);
    const data = await response.json();
    setSession(data.data);
    
    // Trigger calendar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
  };

  if (!sessionId) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <p>Select a session from the calendar to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-600">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-red-600">{error || 'Session not found'}</p>
      </div>
    );
  }

  const duration = session.startTime && session.endTime 
    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
    : 60;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-gray-900">{session.title}</h2>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            title="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-base text-gray-600 mb-4">{session.subject}</p>
        
        {/* Completion Toggle */}
        <div className="mt-3">
          <label className="flex items-center cursor-pointer bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={session.isCompleted || false}
              onChange={handleToggleComplete}
              className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-base font-medium">
              {session.isCompleted ? 'Completed' : 'Mark as completed'}
            </span>
          </label>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {session.isCompleted ? (
          <div className="text-center text-2xl font-semibold text-green-600 mt-8">
            Session Completed! ✓
          </div>
        ) : (
          <>
            {/* Timer Section */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Timer</h3>
              <Timer duration={duration} onComplete={handleSessionComplete} sessionId={sessionId} session={session} />
            </div>

            {/* Notes Section - Takes up most space */}
            <div className="bg-gray-50 rounded-xl p-6 min-h-[400px]">
              <NotesSection sessionId={sessionId} initialNotes={session.notes || ''} />
            </div>

            {/* Study Materials */}
            <div className="bg-gray-50 rounded-xl p-6">
              <StudyMaterialsDisplay exam={session.exam || null} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

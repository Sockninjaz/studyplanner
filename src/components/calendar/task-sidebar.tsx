'use client';

import { useEffect, useState } from 'react';
import { mutate } from 'swr';
import Timer from '@/components/session/timer';
import NotesSection from '@/components/session/notes-section';

interface TaskSidebarProps {
  taskId: string | null;
  onClose: () => void;
}

interface Task {
  _id: string;
  name: string;
  description?: string;
  date: Date;
  isCompleted: boolean;
  notes?: string;
}

export default function TaskSidebar({ taskId, onClose }: TaskSidebarProps) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    const fetchTask = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const tasks = await response.json();
        const foundTask = tasks.find((t: Task) => t._id === taskId);
        if (foundTask) {
          setTask(foundTask);
        } else {
          setError('Task not found');
        }
      } catch (err) {
        setError('Failed to load task');
        console.error('Error fetching task:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  const handleTaskComplete = async () => {
    if (!taskId) return;

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: true }),
    });

    // Refresh task data
    const response = await fetch(`/api/tasks`);
    const tasks = await response.json();
    const updatedTask = tasks.find((t: Task) => t._id === taskId);
    if (updatedTask) {
      setTask(updatedTask);
    }

    // Trigger calendar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
  };

  const handleToggleComplete = async () => {
    if (!taskId || !task) return;

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: !task.isCompleted }),
    });

    // Refresh task data
    const response = await fetch(`/api/tasks`);
    const tasks = await response.json();
    const updatedTask = tasks.find((t: Task) => t._id === taskId);
    if (updatedTask) {
      setTask(updatedTask);
    }

    // Trigger calendar refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendarUpdated'));
    }
  };

  if (!taskId) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        <p>Select a task from the calendar to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-600">Loading task...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-red-600">{error || 'Task not found'}</p>
      </div>
    );
  }

  const duration = 60; // Default duration for tasks

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-gray-900">{task.name}</h2>
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
        <p className="text-base text-gray-600 mb-4">{task.description || ''}</p>

        {/* Completion Toggle */}
        <div className="mt-3">
          <label className="flex items-center cursor-pointer bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={task.isCompleted || false}
              onChange={handleToggleComplete}
              className="mr-3 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-base font-medium">
              {task.isCompleted ? 'Completed' : 'Mark as completed'}
            </span>
          </label>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {task.isCompleted ? (
          <div className="text-center text-green-600 mt-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-2xl font-semibold">Task Completed!</span>
          </div>
        ) : (
          <>
            {/* Timer Section */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Study Timer</h3>
              <Timer duration={duration} onComplete={handleTaskComplete} sessionId={taskId} session={task} />
            </div>

            {/* Notes Section - Takes up most space */}
            <div className="bg-gray-50 rounded-xl p-6 min-h-[400px]">
              <NotesSection sessionId={taskId} initialNotes={task.notes || ''} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

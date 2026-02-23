'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  editingTaskId?: string | null;
}

export default function CreateTaskModal({ isOpen, onClose, selectedDate, editingTaskId }: CreateTaskModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load task data if editing
  useEffect(() => {
    if (isOpen && editingTaskId) {
      loadTaskData();
    } else if (!isOpen) {
      // Reset form when modal closes
      setName('');
      setDescription('');
    }
  }, [isOpen, editingTaskId]);

  const loadTaskData = async () => {
    if (!editingTaskId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/tasks');
      const tasks = await response.json();
      const task = tasks.find((t: any) => t._id === editingTaskId);
      
      if (task) {
        setName(task.name);
        setDescription(task.description || '');
      }
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!selectedDate && !editingTaskId)) return;

    setIsSubmitting(true);
    try {
      const url = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';
      const method = editingTaskId ? 'PUT' : 'POST';
      const body = editingTaskId 
        ? {
            name: name.trim(),
            description: description.trim(),
          }
        : {
            name: name.trim(),
            description: description.trim(),
            date: selectedDate,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to create task');

      mutate('/api/calendar/events');
      mutate('/api/tasks');
      
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{editingTaskId ? 'Edit Task' : 'Add Task'}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="task-name" className="block text-sm font-medium text-gray-700 mb-1">
                Task Name *
              </label>
              <input
                id="task-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter task name"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Add a description..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

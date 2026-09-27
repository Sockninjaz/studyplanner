'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { 
  CheckSquare, 
  Calendar as CalendarIcon, 
  AlignLeft, 
  X, 
  Sparkles,
  Loader2
} from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: string;
  editingTaskId?: string | null;
}

export default function CreateTaskModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  editingTaskId 
}: CreateTaskModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Helper to get formatted today string (YYYY-MM-DD)
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Load task data if editing, or set initial date
  useEffect(() => {
    if (isOpen) {
      if (editingTaskId) {
        loadTaskData();
      } else {
        setName('');
        setDescription('');
        setTaskDate(selectedDate || getTodayStr());
      }
    } else {
      setName('');
      setDescription('');
      setIsLoading(false);
    }
  }, [isOpen, editingTaskId, selectedDate]);

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
        if (task.date) {
          const d = new Date(task.date);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setTaskDate(`${y}-${m}-${day}`);
        } else {
          setTaskDate(selectedDate || getTodayStr());
        }
      }
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !taskDate) return;

    setIsSubmitting(true);
    try {
      const url = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';
      const method = editingTaskId ? 'PUT' : 'POST';
      const body = {
        name: trimmedName,
        description: description.trim(),
        date: taskDate,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save task');
      }

      // Fast cache refresh
      mutate('/api/calendar/events');
      mutate('/api/tasks');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
      
      setName('');
      setDescription('');
      onClose();
    } catch (error: any) {
      console.error('Error saving task:', error);
      alert(error?.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formattedDatePreview = taskDate
    ? new Date(`${taskDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar matching Calendar Task Amber Color */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
              <CheckSquare size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                {editingTaskId ? 'Edit Task' : 'Add New Task'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editingTaskId ? 'Update task details or schedule' : 'Keep track of to-dos and assignments'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-xs text-slate-500">Loading task data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Task Name Field */}
            <div>
              <label 
                htmlFor="task-name" 
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Task Title <span className="text-amber-500">*</span>
              </label>
              <input
                id="task-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-400 transition-all"
                placeholder="e.g., Complete Chapter 3 problem set"
                required
                autoFocus
              />
            </div>

            {/* Date Picker Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label 
                  htmlFor="task-date" 
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Date <span className="text-amber-500">*</span>
                </label>
                {formattedDatePreview && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-800/40">
                    {formattedDatePreview}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="task-date"
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-400 transition-all cursor-pointer"
                  required
                />
                <CalendarIcon 
                  size={16} 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
                />
              </div>
            </div>

            {/* Description Field */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlignLeft size={13} className="text-slate-400" />
                <label 
                  htmlFor="task-description" 
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  Description <span className="text-xs font-normal text-slate-400 lowercase">(optional)</span>
                </label>
              </div>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-400 transition-all resize-none"
                placeholder="Add subtasks, notes, or reference links..."
                rows={3}
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !taskDate || isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>{editingTaskId ? 'Save Changes' : 'Create Task'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

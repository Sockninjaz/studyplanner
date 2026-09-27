'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Circle, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  Edit3, 
  X, 
  AlignLeft,
  Check
} from 'lucide-react';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onEdit?: (taskId: string) => void;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TaskDetailModal({
  isOpen,
  onClose,
  taskId,
  onEdit,
}: TaskDetailModalProps) {
  const { data: tasks, mutate: mutateTasks } = useSWR<any[]>(
    isOpen && taskId ? '/api/tasks' : null,
    fetcher
  );

  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !taskId) return null;

  const task = tasks?.find((t: any) => t._id === taskId);

  const handleToggleComplete = async () => {
    if (!task || isToggling) return;
    const newStatus = !task.isCompleted;
    setIsToggling(true);

    if (newStatus) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }

    // Optimistically update SWR cache
    if (tasks) {
      const updated = tasks.map((t: any) => 
        t._id === taskId ? { ...t, isCompleted: newStatus } : t
      );
      mutateTasks(updated, false);
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update task');

      mutateTasks();
      mutate('/api/calendar/events');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
    } catch (err) {
      console.error('Error toggling task:', err);
      mutateTasks();
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!task || isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete task');

      mutateTasks();
      mutate('/api/calendar/events');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
      onClose();
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const formattedDate = task?.date
    ? new Date(task.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span 
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
                task?.isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
              }`}
            >
              {task?.isCompleted ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                  Completed
                </>
              ) : (
                <>
                  <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                  In Progress
                </>
              )}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Task Main Content */}
        <div className="px-6 py-3 space-y-4">
          <div>
            <h3 className={`text-xl font-bold transition-all ${
              task?.isCompleted
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100'
            }`}>
              {task?.name || 'Loading task...'}
            </h3>

            {formattedDate && (
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <CalendarIcon size={15} className="text-slate-400 dark:text-slate-500" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              <AlignLeft size={13} />
              Description
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task?.description || <span className="text-slate-400 dark:text-slate-500 italic">No description provided</span>}
            </p>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-6 pt-3 space-y-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Main Primary Action: Toggle Finish/Complete */}
          <button
            onClick={handleToggleComplete}
            disabled={isToggling || !task}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm shadow-sm transition-all duration-200 active:scale-[0.98] ${
              task?.isCompleted
                ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-md'
            }`}
          >
            {task?.isCompleted ? (
              <>
                <Circle size={16} className="text-slate-400" />
                Mark as Incomplete
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                Finish Task
              </>
            )}
          </button>

          {/* Secondary Actions: Edit & Delete */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(taskId);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs transition-colors shadow-sm"
              >
                <Edit3 size={14} />
                Edit
              </button>
            )}

            {confirmDelete ? (
              <div className="flex-1 flex items-center gap-1.5">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm text-center"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="py-2 px-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200/80 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-medium text-xs transition-colors"
              >
                <Trash2 size={14} />
                Delete Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

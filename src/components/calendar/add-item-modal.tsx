'use client';

import { useEffect, useRef } from 'react';
import { GraduationCap, CheckSquare, Ban, CalendarCheck, X } from 'lucide-react';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExam: () => void;
  onAddTask: () => void;
  date?: string; // YYYY-MM-DD
  anchorPosition?: { x: number; y: number } | null;
  isBlocked?: boolean;
  onToggleBlock?: () => void;
  isTogglingBlock?: boolean;
}

export default function AddItemModal({
  isOpen,
  onClose,
  onAddExam,
  onAddTask,
  date,
  anchorPosition,
  isBlocked = false,
  onToggleBlock,
  isTogglingBlock = false,
}: AddItemModalProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate coordinates synchronously during render so there is no animation or sliding from the previous position
  const DROPDOWN_WIDTH = 188;
  const DROPDOWN_HEIGHT = 142;
  const PADDING = 12;

  let left = anchorPosition ? anchorPosition.x : 0;
  let top = anchorPosition ? anchorPosition.y + 6 : 0;

  if (typeof window !== 'undefined') {
    if (left + DROPDOWN_WIDTH > window.innerWidth - PADDING) {
      left = anchorPosition ? anchorPosition.x - DROPDOWN_WIDTH : window.innerWidth - DROPDOWN_WIDTH - PADDING;
    }
    if (top + DROPDOWN_HEIGHT > window.innerHeight - PADDING) {
      top = anchorPosition ? anchorPosition.y - DROPDOWN_HEIGHT - 6 : window.innerHeight - DROPDOWN_HEIGHT - PADDING;
    }
    left = Math.max(PADDING, Math.round(left));
    top = Math.max(PADDING, Math.round(top));
  }

  // Format date display (e.g. "Sun, Sep 27")
  const formattedDate = date
    ? (() => {
        try {
          const parts = date.split('-');
          if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          }
          return date;
        } catch {
          return date;
        }
      })()
    : null;

  return (
    <>
      {/* Completely transparent click-outside overlay (calendar remains fully visible and crisp) */}
      <div
        className="fixed inset-0 z-40 bg-transparent cursor-default"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Floating Dropdown Card */}
      <div
        ref={dropdownRef}
        style={{
          top: `${top}px`,
          left: `${left}px`,
        }}
        className="fixed z-50 w-[188px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/15 dark:shadow-black/50 p-1 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dropdown Header with Date and Status */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {formattedDate || 'Schedule Day'}
            </span>
            {isBlocked && (
              <span className="text-[9.5px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 rounded px-1 py-0.2">
                Blocked
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Options List */}
        <div className="pt-1 space-y-0.5">
          {/* Add Exam */}
          <button
            onClick={onAddExam}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg transition-colors group hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <GraduationCap size={14} />
            </div>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
              Add Exam
            </span>
          </button>

          {/* Add Task */}
          <button
            onClick={onAddTask}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg transition-colors group hover:bg-amber-50/80 dark:hover:bg-amber-950/40"
          >
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
              <CheckSquare size={14} />
            </div>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
              Add Task
            </span>
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

          {/* Block / Unblock Day */}
          {onToggleBlock && (
            <button
              onClick={onToggleBlock}
              disabled={isTogglingBlock}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg transition-colors group ${
                isBlocked
                  ? 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40'
                  : 'hover:bg-rose-50/80 dark:hover:bg-rose-950/40'
              } ${isTogglingBlock ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div
                className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 ${
                  isBlocked
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-800/60 text-rose-500 dark:text-rose-400'
                }`}
              >
                {isBlocked ? <CalendarCheck size={14} /> : <Ban size={14} />}
              </div>
              <span
                className={`text-xs font-medium transition-colors truncate ${
                  isBlocked
                    ? 'text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                    : 'text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400'
                }`}
              >
                {isTogglingBlock ? 'Updating...' : isBlocked ? 'Unblock Day' : 'Block Day'}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

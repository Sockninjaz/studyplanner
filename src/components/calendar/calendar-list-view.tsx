'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import SessionSidebar from './session-sidebar';
import CreateTaskModal from './create-task-modal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CalendarListViewProps {
  onSessionClick?: (sessionId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onAddItemClick?: (date: string) => void;
  onExamView?: (examId: string) => void;
  onExamEdit?: (examId: string) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
  viewMode?: 'all' | 'today';
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'session' | 'task';
  subject?: string;
  startTime?: string;
  endTime?: string;
  isCompleted?: boolean;
  sessionId?: string;
  taskId?: string;
  name?: string;
  description?: string;
  color?: string;
}

interface GroupedEvents {
  [date: string]: Event[];
}

export default function CalendarListView({
  onSessionClick,
  onTaskClick,
  onAddItemClick,
  onExamView,
  onExamEdit,
  sidebarOpen,
  sidebarCollapsed,
  viewMode = 'all'
}: CalendarListViewProps) {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);
  const { data: blockedData, mutate: mutateBlocked } = useSWR('/api/blocked-days', fetcher);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});
  const [draggedSession, setDraggedSession] = useState<Event | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [togglingBlock, setTogglingBlock] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskDate, setSelectedTaskDate] = useState<string>('');
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const blockedDays: Set<string> = new Set(
    blockedData?.data?.map((d: string) => {
      const date = new Date(d + 'T00:00:00.000Z');
      return date.toDateString();
    }) || []
  );

  useEffect(() => {
    // Listen for calendar updates and exam deletions
    const handleCalendarUpdate = () => {
      mutate();
    };

    const handleExamDeletion = () => {
      mutate();
    };

    // Close task menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (openTaskMenuId) {
        setOpenTaskMenuId(null);
      }
    };

    window.addEventListener('calendarUpdated', handleCalendarUpdate);
    window.addEventListener('examDeleted', handleExamDeletion);
    document.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('calendarUpdated', handleCalendarUpdate);
      window.removeEventListener('examDeleted', handleExamDeletion);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openTaskMenuId, mutate]);

  useEffect(() => {
    // Determine the range of dates to display
    const grouped: GroupedEvents = {};
    const today = new Date();

    if (viewMode === 'today') {
      // Only show today
      grouped[today.toDateString()] = [];
    } else {
      // Show next 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toDateString();
        grouped[dateStr] = [];
      }
    }

    // Then add events to the appropriate dates
    if (data?.data) {
      const events: Event[] = data.data.map((event: any) => ({
        id: event.id,
        title: event.title,
        date: event.start ? new Date(event.start).toDateString() : '',
        type: event.extendedProps?.type || 'session',
        subject: event.extendedProps?.subject || event.title,
        startTime: event.start,
        endTime: event.end,
        isCompleted: event.extendedProps?.isCompleted || false,
        sessionId: event.extendedProps?.sessionId,
        taskId: event.extendedProps?.taskId,
        name: event.extendedProps?.name,
        description: event.extendedProps?.description,
        color: event.extendedProps?.color
      }));

      // Filter events if in 'today' mode
      const relevantEvents = viewMode === 'today'
        ? events.filter(e => e.date === today.toDateString())
        : events;

      // Add structure for past dates that have events (only in 'all' mode)
      if (viewMode === 'all') {
        relevantEvents.forEach(event => {
          if (event.startTime) {
            const eventDate = new Date(event.startTime);
            const now = new Date();
            if (eventDate < now && !grouped[event.date]) {
              // This is a past date with events, add it to the structure
              grouped[event.date] = [];
            }
          }
        });
      }

      // Add events to their dates
      relevantEvents.forEach(event => {
        if (grouped[event.date]) {
          grouped[event.date].push(event);
        }
      });

      // Sort events within each date by time
      Object.keys(grouped).forEach(date => {
        grouped[date].sort((a, b) => {
          if (a.startTime && b.startTime) {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          }
          return 0;
        });
      });
    }

    // Sort dates chronologically
    const sortedDates = Object.keys(grouped).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    const sortedGrouped: GroupedEvents = {};
    sortedDates.forEach(date => {
      sortedGrouped[date] = grouped[date];
    });

    setGroupedEvents(sortedGrouped);
  }, [data, viewMode]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleEventClick = (event: Event) => {
    if (event.type === 'session' && event.sessionId && onSessionClick) {
      onSessionClick(event.sessionId);
    } else if (event.type === 'exam' && onExamView) {
      onExamView(event.id);
    } else if (event.type === 'task' && event.taskId && onTaskClick) {
      onTaskClick(event.taskId);
    }
  };

  const handleTaskDelete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');

      mutate('/api/calendar/events');
      mutate('/api/tasks');
      setOpenTaskMenuId(null);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('calendarUpdated'));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleTaskEdit = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTaskMenuId(null);
    setEditingTaskId(taskId);

    // Find the task and set the date for the modal
    const task = Object.values(groupedEvents).flat().find(event =>
      event.type === 'task' && event.taskId === taskId
    );

    if (task) {
      setSelectedTaskDate(task.date);
      setIsTaskModalOpen(true);
    }
  };

  const handleDragStart = (e: React.DragEvent, event: Event) => {
    if (event.type !== 'session' || !event.sessionId) {
      e.preventDefault();
      return;
    }
    setDraggedSession(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedSession(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedSession || !draggedSession.sessionId) return;
    if (draggedSession.date === targetDate) {
      setDraggedSession(null);
      return;
    }

    try {
      const targetDateObj = new Date(targetDate);
      const originalStart = new Date(draggedSession.startTime!);
      const originalEnd = new Date(draggedSession.endTime!);

      const newStart = new Date(targetDateObj);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

      const newEnd = new Date(targetDateObj);
      newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);

      const response = await fetch(`/api/sessions/${draggedSession.sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update session');

      mutate();
      setDraggedSession(null);
    } catch (error) {
      console.error('Error moving session:', error);
      alert('Failed to move session');
      setDraggedSession(null);
    }
  };

  if (error) return <div>Failed to load calendar events</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">

        {/* Events List */}
        <div className="p-4 space-y-6">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-12 text-[#4a4a4a]">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-[#4a4a4a] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-[#4a4a4a] mb-2">No events scheduled</h3>
              <p className="text-[#4a4a4a] opacity-70">Get started by adding your first exam</p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, events]) => (
              <div
                key={date}
                className="border-b border-[#4a4a4a] border-opacity-20 pb-6 last:border-b-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
              >
                {/* Date Header */}
                <div
                  className={`flex items-center justify-between py-2 px-1 rounded-md cursor-pointer select-none transition-colors ${blockedDays.has(date) ? 'opacity-50' : ''
                    }`}
                  onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-4 h-4 text-[#4a4a4a] opacity-40 transition-transform duration-200 ${expandedDate === date ? 'rotate-90' : ''
                        }`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-sm font-medium text-[#4a4a4a]">{formatDate(date)}</h3>
                    {events.length > 0 && (
                      <span className="text-xs text-[#4a4a4a] opacity-50">
                        {events.length} {events.length === 1 ? 'item' : 'items'}
                      </span>
                    )}
                    {blockedDays.has(date) && (
                      <span className="text-xs text-[#4a4a4a] opacity-40 bg-[#4a4a4a] bg-opacity-10 px-1.5 py-0.5 rounded">
                        Blocked
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onAddItemClick) {
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        onAddItemClick(`${year}-${month}-${day}`);
                      }
                    }}
                    className="text-[rgb(54,65,86)] hover:text-opacity-80 transition-colors"
                    title="Add exam"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Section */}
                {expandedDate === date && (
                  <div className="ml-6 mt-2 mb-3 flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddItemClick) {
                          const d = new Date(date);
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          onAddItemClick(`${year}-${month}-${day}`);
                        }
                      }}
                      className="text-xs font-medium text-[rgb(40,57,135)] hover:bg-[rgb(40,57,135)] hover:bg-opacity-10 px-3 py-1.5 rounded-md border border-[rgb(40,57,135)] border-opacity-30 transition-colors"
                    >
                      + Add Exam
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        setSelectedTaskDate(`${year}-${month}-${day}`);
                        setIsTaskModalOpen(true);
                      }}
                      className="text-xs font-medium text-amber-600 hover:bg-amber-600 hover:bg-opacity-10 px-3 py-1.5 rounded-md border border-amber-600 border-opacity-30 transition-colors"
                    >
                      + Add Task
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (togglingBlock) return;
                        setTogglingBlock(true);
                        try {
                          const d = new Date(date);
                          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          const isBlocked = blockedDays.has(date);
                          await fetch('/api/blocked-days', {
                            method: isBlocked ? 'DELETE' : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ date: dateStr }),
                          });
                          mutateBlocked();
                        } catch (err) {
                          console.error('Failed to toggle block:', err);
                        } finally {
                          setTogglingBlock(false);
                        }
                      }}
                      disabled={togglingBlock}
                      className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${blockedDays.has(date)
                        ? 'text-[#4a4a4a] border-[#4a4a4a] border-opacity-30 hover:bg-[#4a4a4a] hover:bg-opacity-10'
                        : 'text-red-600 border-red-300 hover:bg-red-50'
                        } ${togglingBlock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {blockedDays.has(date) ? 'Unblock this day' : 'Block this day'}
                    </button>
                  </div>
                )}

                {/* Events for this date */}
                {events.length === 0 ? (
                  <div className="text-center py-4 text-[#4a4a4a] opacity-50 text-sm">
                    No sessions scheduled
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event, index) => {
                      const eventColor = event.type === 'task'
                        ? '#f59e0b' // Amber for tasks
                        : (event.color || '#3b82f6'); // Use API color or fallback blue

                      return (
                        <div
                          key={event.id}
                          draggable={event.type === 'session' && !!event.sessionId}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleEventClick(event)}
                          className={`group flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:cursor-pointer ${event.type === 'session' && !!event.sessionId
                            ? 'hover:cursor-grab active:cursor-grabbing'
                            : ''
                            } ${event.type === 'exam'
                              ? `border-opacity-30 bg-opacity-10 hover:bg-opacity-20`
                              : event.type === 'task'
                                ? event.isCompleted
                                  ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                  : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                                : event.isCompleted
                                  ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                  : 'border-[#4a4a4a] border-opacity-20 bg-[#f8f6ef] hover:bg-opacity-80'
                            }`}
                          style={{
                            borderColor: event.type === 'exam' ? eventColor : undefined,
                            backgroundColor: event.type === 'exam' ? `${eventColor}10` : undefined
                          }}
                        >
                          {/* Event Type Icon */}
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                            style={{ backgroundColor: event.isCompleted && event.type === 'task' ? '#10b981' : eventColor }}
                          >
                            {event.type === 'exam' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            ) : event.type === 'task' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4
                                className={`font-medium truncate ${event.isCompleted ? 'line-through' : ''
                                  }`}
                                style={{
                                  color: event.type === 'exam' ? eventColor : '#4a4a4a'
                                }}
                              >
                                {event.title}
                              </h4>
                              {event.isCompleted && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  Completed
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-[#4a4a4a] opacity-70">
                              {event.subject && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                  {event.subject}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          {event.type === 'exam' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onExamEdit) {
                                  onExamEdit(event.id);
                                }
                              }}
                              className="text-[#4a4a4a] opacity-40 hover:opacity-70 transition-opacity p-1 rounded hover:bg-[#4a4a4a] hover:bg-opacity-10"
                              title="Edit exam"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          ) : event.type === 'task' ? (
                            /* 3-dots menu for tasks */
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenTaskMenuId(openTaskMenuId === event.id ? null : event.id);
                                }}
                                className="text-[#4a4a4a] opacity-40 hover:opacity-70 transition-opacity p-1 rounded hover:bg-[#4a4a4a] hover:bg-opacity-10"
                                title="Task options"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>

                              {/* Dropdown menu */}
                              {openTaskMenuId === event.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                  <button
                                    onClick={(e) => handleTaskEdit(event.taskId!, e)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => handleTaskDelete(event.taskId!, e)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Click indicator for sessions */
                            <div className="text-[#4a4a4a] opacity-40 group-hover:opacity-70 transition-opacity">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskDate('');
          setEditingTaskId(null);
        }}
        selectedDate={selectedTaskDate}
        editingTaskId={editingTaskId}
      />
    </div>
  );
}

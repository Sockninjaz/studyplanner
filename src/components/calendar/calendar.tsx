'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CalendarProps {
  onSessionClick?: (sessionId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onAddItemClick?: (date: string, position?: { x: number; y: number }) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
  onDatesSet?: (info: any) => void;
  blockedDays?: Set<string>;
}

const Calendar = forwardRef<any, CalendarProps>(({ 
  onSessionClick, 
  onTaskClick, 
  onAddItemClick, 
  sidebarOpen, 
  sidebarCollapsed, 
  onDatesSet,
  blockedDays 
}, ref) => {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);
  const calendarRef = useRef<FullCalendar>(null);
  // Keep a ref to the latest onAddItemClick so dayCellDidMount closures always use the current callback
  const onAddItemClickRef = useRef(onAddItemClick);
  onAddItemClickRef.current = onAddItemClick;
  const blockedDaysRef = useRef(blockedDays);
  blockedDaysRef.current = blockedDays;

  useImperativeHandle(ref, () => ({
    getApi: () => calendarRef.current?.getApi(),
  }));

  const handleEventDrop = async (info: any) => {
    // Only handle session events (exams/tasks have editable:false so won't reach here anyway)
    const sessionId = info.event.extendedProps?.sessionId;
    if (!sessionId) {
      info.revert();
      return;
    }

    // Build the new start/end times preserving the original duration
    const oldStart = info.oldEvent.start as Date;
    const oldEnd = info.oldEvent.end as Date | null;
    const newStart = info.event.start as Date;
    const duration = oldEnd ? oldEnd.getTime() - oldStart.getTime() : 60 * 60 * 1000; // default 1h
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newStart.toISOString(),
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });

      if (!res.ok) throw new Error('Failed to update session');
      mutate(); // Refresh calendar events
    } catch (err) {
      console.error('Session drag failed:', err);
      info.revert(); // Snap event back to original position
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      mutate();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('calendarUpdated', handleUpdate);
      window.addEventListener('preferencesUpdated', handleUpdate);
      window.addEventListener('examDeleted', handleUpdate);
      return () => {
        window.removeEventListener('calendarUpdated', handleUpdate);
        window.removeEventListener('preferencesUpdated', handleUpdate);
        window.removeEventListener('examDeleted', handleUpdate);
      };
    }
  }, [mutate]);

  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      setTimeout(() => {
        calendarApi.updateSize();
      }, 300);
    }
  }, [sidebarOpen, sidebarCollapsed]);


  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-white dark:bg-slate-900">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Failed to load calendar events</p>
        <button onClick={() => mutate()} className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full bg-white dark:bg-slate-900 p-4 animate-pulse flex flex-col gap-4">
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-6 bg-slate-200 dark:bg-slate-800 rounded"></div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 flex-1">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="bg-slate-100 dark:bg-slate-800/40 rounded-lg border border-slate-200/50 dark:border-slate-800 min-h-[60px]"></div>
          ))}
        </div>
      </div>
    );
  }

  const events = data?.data || [];

  return (
    <div className="h-full bg-white dark:bg-slate-900">
      <FullCalendar
        key={Array.from(blockedDays || []).sort().join(',')}
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        events={events}
        editable={true}
        eventDrop={handleEventDrop}
        height="100%"
        dayMaxEvents={5}
        datesSet={onDatesSet}
        dateClick={(info) => {
          if (onAddItemClickRef.current) {
            onAddItemClickRef.current(info.dateStr, {
              x: info.jsEvent.clientX,
              y: info.jsEvent.clientY
            });
          }
        }}
        dayCellClassNames={(arg) => {
          const d = arg.date;
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dStr = `${year}-${month}-${day}`;
          if (blockedDaysRef.current?.has(dStr)) {
            return ['fc-day-blocked'];
          }
          return [];
        }}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: false,
          hour12: false
        }}
        displayEventTime={false}
        dayHeaderFormat={{ weekday: 'short' }}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          if (info.event.extendedProps?.type === 'exam') {
            const examId = info.event.extendedProps?.examId;
            router.push(examId ? `/exams/${examId}` : '/exams');
          } else if (info.event.extendedProps?.type === 'session' && info.event.extendedProps?.sessionId) {
            if (onSessionClick) {
              onSessionClick(info.event.extendedProps.sessionId);
            }
          } else if (info.event.extendedProps?.type === 'task' && info.event.extendedProps?.taskId) {
            if (onTaskClick) {
              onTaskClick(info.event.extendedProps.taskId);
            }
          }
        }}
        dayCellDidMount={(info) => {
          const dayCell = info.el;
          const dateObj = info.date;
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const dayTop = dayCell.querySelector('.fc-daygrid-day-top');

          if (dayTop) {
            // Prevent duplicate buttons during React HMR or FullCalendar re-renders
            if (dayTop.querySelector('.fc-add-btn')) return;

            const addButton = document.createElement('button');
            addButton.innerHTML = '+';
            addButton.className = 'fc-add-btn transition-opacity hover:bg-gray-100 dark:hover:bg-slate-800 rounded px-1.5 ml-1 text-sm font-medium';
            addButton.title = 'Add exam or event';
            addButton.style.opacity = '0'; // default hidden, css hover will reveal it

            // Append to day-top so it appears to the right of the date number
            dayTop.appendChild(addButton);

            dayCell.addEventListener('mouseenter', () => {
              addButton.style.opacity = '1';
            });
            dayCell.addEventListener('mouseleave', () => {
              addButton.style.opacity = '0';
            });

            // Use pointerdown to bypass internal FullCalendar touch interference
            addButton.addEventListener('pointerdown', (e) => {
              e.stopPropagation();
              e.preventDefault();
            });

            // Check if day is blocked
            if (blockedDaysRef.current?.has(dateStr)) {
              const blockedBadge = document.createElement('span');
              blockedBadge.className = 'fc-blocked-badge text-[9.5px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 rounded px-1 ml-auto mr-1 select-none pointer-events-none';
              blockedBadge.textContent = 'Blocked';
              dayTop.appendChild(blockedBadge);
            }

            addButton.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onAddItemClickRef.current) {
                onAddItemClickRef.current(dateStr, {
                  x: e.clientX,
                  y: e.clientY
                });
              }
            });
          }
        }}
        eventClassNames={(arg) => {
          const classes: string[] = [];
          if (arg.event.extendedProps?.isCompleted) {
            classes.push('fc-event-completed');
          }
          if (arg.event.extendedProps?.type === 'task') {
            classes.push('fc-event-task');
          }
          return classes;
        }}
        eventDidMount={(info) => {
          const event = info.event;
          info.el.style.cursor = 'pointer';
          
          if (event.extendedProps?.type === 'exam') {
            if (event.extendedProps?.isCompleted) {
              info.el.style.textDecoration = 'line-through';
              info.el.style.opacity = '0.7';
              const titleEl = info.el.querySelector('.fc-event-title') as HTMLElement | null;
              if (titleEl) titleEl.style.textDecoration = 'line-through';
            } else {
              info.el.style.textDecoration = 'underline';
            }
          } else if (event.extendedProps?.type === 'session') {
            if (event.extendedProps?.isCompleted) {
              info.el.style.textDecoration = 'line-through';
              info.el.style.opacity = '0.7';
              const titleEl = info.el.querySelector('.fc-event-title') as HTMLElement | null;
              if (titleEl) titleEl.style.textDecoration = 'line-through';
            }
          } else if (event.extendedProps?.type === 'task') {
            if (event.extendedProps?.isCompleted) {
              info.el.style.textDecoration = 'line-through';
              info.el.style.opacity = '0.7';
              const titleEl = info.el.querySelector('.fc-event-title') as HTMLElement | null;
              if (titleEl) titleEl.style.textDecoration = 'line-through';
            }
          }
        }}
      />
      <style jsx global>{`
        .fc-event-completed,
        .fc-event-completed .fc-event-title,
        .fc-event-completed .fc-event-main,
        .fc-event-completed .fc-event-title-container {
          text-decoration: line-through !important;
          opacity: 0.7 !important;
        }
        .fc-day-blocked {
          background-color: rgba(244, 63, 94, 0.04) !important;
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 6px,
            rgba(244, 63, 94, 0.04) 6px,
            rgba(244, 63, 94, 0.04) 12px
          ) !important;
        }
        :global(.dark) .fc-day-blocked {
          background-color: rgba(244, 63, 94, 0.08) !important;
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 6px,
            rgba(244, 63, 94, 0.08) 6px,
            rgba(244, 63, 94, 0.08) 12px
          ) !important;
        }
        .fc-event-task {
          cursor: pointer !important;
          border-radius: 5px !important;
          font-weight: 500 !important;
          transition: transform 0.15s ease, box-shadow 0.15s ease !important;
        }
        .fc-event-task:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(245, 158, 11, 0.35) !important;
        }
        .fc {
          --fc-border-color: #e5e7eb;
          --fc-button-text-color: #374151;
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #d1d5db;
          --fc-button-hover-bg-color: #f3f4f6;
          --fc-button-hover-border-color: #9ca3af;
          --fc-button-active-bg-color: #e5e7eb;
          --fc-button-active-border-color: #6b7280;
        }
        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }
        .fc .fc-col-header-cell-cushion {
          padding: 8px 0;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #6b7280;
          text-decoration: none;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: #f3f4f6;
        }
        :global(.dark) .fc-theme-standard td, :global(.dark) .fc-theme-standard th {
          border-color: #334155;
        }
        .fc-theme-standard .fc-scrollgrid {
          border: none !important;
        }
        .fc {
          border: none !important;
        }
        .fc-view-harness {
          border: none !important;
        }
        .fc .fc-scrollgrid-section-header > * {
          border-top: none !important;
          border-bottom: none !important;
        }
        .fc .fc-col-header {
          border-top: none !important;
        }
        .fc-col-header-cell {
          border-top: none !important;
        }
        .fc-daygrid-day-top {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 0 2px;
        }
        .fc-daygrid-day-number {
          padding: 2px 6px !important;
          font-size: 0.75rem;
          color: #374151;
          text-decoration: none !important;
          z-index: 1;
        }
        :global(.dark) .fc-daygrid-day-number {
          color: #f8fafc;
        }
        .fc-add-btn {
          color: #6b7280;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          opacity: 0;
        }
        .fc-daygrid-day:hover .fc-add-btn {
          opacity: 1;
        }
        .fc-day-today {
          background-color: transparent !important;
        }
        .fc-day-today .fc-add-btn {
          color: #ef4444;
        }
        .fc-day-today .fc-daygrid-day-number {
          background-color: #ef4444;
          color: white;
          border-radius: 4px;
          margin: 1px;
          display: inline-block;
          width: 20px;
          height: 20px;
          padding: 0 !important;
          line-height: 20px;
          text-align: center;
        }
        .fc-event-title {
          font-size: 0.7rem !important;
          font-weight: 500;
          line-height: 1.2;
          padding: 0.5px 2px;
        }
        .fc-popover {
          border-radius: 8px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid #e5e7eb !important;
          overflow: hidden !important;
          z-index: 50 !important;
        }
        :global(.dark) .fc-popover {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }
        .fc-popover-header {
          background: #f8fafc !important;
          padding: 10px 12px !important;
          font-weight: 600 !important;
        }
        :global(.dark) .fc-popover-header {
          background: #0f172a !important;
        }
        .fc-popover-body {
          padding: 8px !important;
          max-height: 250px !important;
          overflow-y: auto !important;
        }
      `}</style>
    </div>
  );
});

Calendar.displayName = 'Calendar';
export default Calendar;

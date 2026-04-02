'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CalendarProps {
  onSessionClick?: (sessionId: string) => void;
  onAddItemClick?: (date: string) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
  onDatesSet?: (info: any) => void;
}

const Calendar = forwardRef<any, CalendarProps>(({ onSessionClick, onAddItemClick, sidebarOpen, sidebarCollapsed, onDatesSet }, ref) => {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);
  const calendarRef = useRef<FullCalendar>(null);
  // Keep a ref to the latest onAddItemClick so dayCellDidMount closures always use the current callback
  const onAddItemClickRef = useRef(onAddItemClick);
  onAddItemClickRef.current = onAddItemClick;

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
      window.addEventListener('examDeleted', handleUpdate);
      return () => {
        window.removeEventListener('calendarUpdated', handleUpdate);
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

  if (error) return <div>Failed to load calendar events</div>;
  if (isLoading) return <div>Loading...</div>;

  const events = data?.data || [];

  return (
    <div className="h-full bg-white">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={false}
        events={events}
        editable={true}
        eventDrop={handleEventDrop}
        height="100%"
        dayMaxEvents={3}
        datesSet={onDatesSet}
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
            window.location.href = '/exams';
          } else if (info.event.extendedProps?.type === 'session' && info.event.extendedProps?.sessionId) {
            if (onSessionClick) {
              onSessionClick(info.event.extendedProps.sessionId);
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
            addButton.className = 'fc-add-btn transition-opacity hover:bg-gray-100 rounded px-1.5 ml-1 text-sm font-medium';
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

            addButton.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onAddItemClickRef.current) {
                onAddItemClickRef.current(dateStr);
              }
            });
          }
        }}
        eventDidMount={(info) => {
          const event = info.event;
          if (event.extendedProps?.type === 'exam') {
            info.el.style.cursor = 'pointer';
            info.el.style.textDecoration = 'underline';
          } else if (event.extendedProps?.type === 'session') {
            info.el.style.cursor = 'pointer';
            if (event.extendedProps?.isCompleted) {
              const titleElement = info.el.querySelector('.fc-event-title') as HTMLElement;
              if (titleElement) {
                titleElement.style.textDecoration = 'line-through';
                titleElement.style.opacity = '0.7';
              }
            }
          }
        }}
      />
      <style jsx global>{`
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
          padding: 2px 4px;
        }
        .fc-daygrid-day-number {
          padding: 4px 8px !important;
          font-size: 0.875rem;
          color: #374151;
          text-decoration: none !important;
          z-index: 1;
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
          margin: 2px;
          display: inline-block;
          width: 24px;
          height: 24px;
          padding: 0 !important;
          line-height: 24px;
          text-align: center;
        }
      `}</style>
    </div>
  );
});

Calendar.displayName = 'Calendar';
export default Calendar;

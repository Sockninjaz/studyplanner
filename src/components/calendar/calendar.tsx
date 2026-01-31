'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CalendarProps {
  onSessionClick?: (sessionId: string) => void;
  onAddItemClick?: (date: string) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
}

export default function Calendar({ onSessionClick, onAddItemClick, sidebarOpen, sidebarCollapsed }: CalendarProps) {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);
  const calendarRef = useRef<FullCalendar>(null);

  const handleEventDrop = async (info: any) => {
    const { event } = info;
    const type = event.extendedProps?.type;
    const id = event.extendedProps?.sessionId;

    // Only allow moving study sessions, not exams
    if (type !== 'session' || !id) {
      info.revert();
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: event.start.toISOString(),
          endTime: event.end?.toISOString() || new Date(event.start.getTime() + 60 * 60 * 1000).toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update session');
      mutate();
    } catch (error) {
      console.error('Error updating session position:', error);
      info.revert();
    }
  };

  useEffect(() => {
    const handleUpdate = () => {
      console.log('Calendar update event received, refreshing...');
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
    // Trigger calendar resize when sidebar state changes
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      // Use setTimeout to ensure the DOM has updated before resizing
      setTimeout(() => {
        calendarApi.updateSize();
      }, 300); // Match the transition duration
    }
  }, [sidebarOpen]);

  useEffect(() => {
    // Trigger calendar resize when main sidebar state changes
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      // Use setTimeout to ensure the DOM has updated before resizing
      setTimeout(() => {
        calendarApi.updateSize();
      }, 300); // Match the transition duration
    }
  }, [sidebarCollapsed]);

  if (error) return <div>Failed to load calendar events</div>;
  if (isLoading) return <div>Loading...</div>;

  const events = data?.data || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="listYear"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek,listYear',
        }}
        events={events}
        editable={true}
        eventDrop={handleEventDrop}
        height="auto"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: false,
          hour12: false
        }}
        displayEventTime={false}
        dayHeaderFormat={{ weekday: 'short' }}
        titleFormat={{ 
          month: 'long', 
          year: 'numeric' 
        }}
                eventClick={(info) => {
          info.jsEvent.preventDefault();
          
          if (info.event.extendedProps?.type === 'exam') {
            window.location.href = '/exams';
          } else if (info.event.extendedProps?.type === 'session' && info.event.extendedProps?.sessionId) {
            // Open session in sidebar
            if (onSessionClick) {
              onSessionClick(info.event.extendedProps.sessionId);
            }
          }
        }}
        dayCellDidMount={(info) => {
          // Add + button to date cells on hover
          const dayCell = info.el;
          const dateStr = info.dateStr;
          
          // Create + button element
          const addButton = document.createElement('button');
          addButton.innerHTML = '+';
          addButton.className = 'absolute top-1 right-1 w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-bold hover:bg-indigo-700 transition-colors opacity-0 hover:opacity-100 pointer-events-none z-10';
          addButton.title = 'Add exam or event';
          
          // Add hover effects to show/hide button
          dayCell.style.position = 'relative';
          dayCell.addEventListener('mouseenter', () => {
            addButton.style.opacity = '1';
            addButton.style.pointerEvents = 'auto';
          });
          dayCell.addEventListener('mouseleave', () => {
            addButton.style.opacity = '0';
            addButton.style.pointerEvents = 'none';
          });
          
          // Handle button click
          addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onAddItemClick) {
              onAddItemClick(dateStr);
            }
          });
          
          dayCell.appendChild(addButton);
        }}
        eventDidMount={(info) => {
          // Add custom styling or tooltips if needed
          const event = info.event;
          if (event.extendedProps?.type === 'exam') {
            info.el.style.cursor = 'pointer';
          } else if (event.extendedProps?.type === 'session') {
            // Add cursor pointer for sessions
            info.el.style.cursor = 'pointer';
            
            // Add strikethrough for completed sessions
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
    </div>
  );
}

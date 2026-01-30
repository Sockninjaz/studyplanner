'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Calendar() {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);

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

  if (error) return <div>Failed to load calendar events</div>;
  if (isLoading) return <div>Loading...</div>;

  const events = data?.data || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek',
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
          // Prevent default navigation for certain events if needed
          if (info.event.extendedProps?.type === 'exam') {
            info.jsEvent.preventDefault();
            window.location.href = '/exams';
          }
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

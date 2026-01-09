'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { useEffect } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Calendar() {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/events', fetcher);

  useEffect(() => {
    const handleCalendarUpdate = () => {
      console.log('Calendar update event received, refreshing...');
      mutate();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('calendarUpdated', handleCalendarUpdate);
      return () => {
        window.removeEventListener('calendarUpdated', handleCalendarUpdate);
      };
    }
  }, [mutate]);

  if (error) return <div>Failed to load calendar events</div>;
  if (isLoading) return <div>Loading...</div>;

  const events = data?.data || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek',
        }}
        events={events}
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
            // You could open a modal here instead of navigation
            info.jsEvent.preventDefault();
            window.location.href = '/exams';
          }
        }}
        eventDidMount={(info) => {
          // Add custom styling or tooltips if needed
          const event = info.event;
          if (event.extendedProps?.type === 'exam') {
            info.el.style.cursor = 'pointer';
          }
        }}
      />
    </div>
  );
}

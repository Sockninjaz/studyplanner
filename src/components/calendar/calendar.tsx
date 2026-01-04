'use client';

import useSWR from 'swr';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Calendar() {
  const { data, error, isLoading } = useSWR('/api/sessions', fetcher);

  if (error) return <div>Failed to load sessions</div>;
  if (isLoading) return <div>Loading...</div>;

  const events = data?.data?.map((session: any) => ({
    id: session._id,
    title: session.title,
    start: session.scheduledDate,
    end: new Date(new Date(session.scheduledDate).getTime() + session.duration * 60000),
    allDay: false,
    url: `/session/${session._id}`,
  })) || [];

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
      />
    </div>
  );
}

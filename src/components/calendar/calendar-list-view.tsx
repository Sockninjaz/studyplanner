'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import SessionSidebar from './session-sidebar';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CalendarListViewProps {
  onSessionClick?: (sessionId: string) => void;
  onAddItemClick?: (date: string) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'session';
  subject?: string;
  startTime?: string;
  endTime?: string;
  isCompleted?: boolean;
  sessionId?: string;
}

interface GroupedEvents {
  [date: string]: Event[];
}

export default function CalendarListView({ 
  onSessionClick, 
  onAddItemClick, 
  sidebarOpen, 
  sidebarCollapsed 
}: CalendarListViewProps) {
  const { data, error, isLoading } = useSWR('/api/calendar/events', fetcher);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});

  useEffect(() => {
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
        sessionId: event.extendedProps?.sessionId
      }));

      // Group events by date
      const grouped: GroupedEvents = {};
      events.forEach(event => {
        if (!grouped[event.date]) {
          grouped[event.date] = [];
        }
        grouped[event.date].push(event);
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

      // Sort dates chronologically
      const sortedDates = Object.keys(grouped).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
      );

      const sortedGrouped: GroupedEvents = {};
      sortedDates.forEach(date => {
        sortedGrouped[date] = grouped[date];
      });

      setGroupedEvents(sortedGrouped);
    }
  }, [data]);

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
              <div key={date} className="border-b border-[#4a4a4a] border-opacity-20 pb-6 last:border-b-0">
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-[#4a4a4a]">{formatDate(date)}</h3>
                  <span className="text-sm text-[#4a4a4a] bg-[#f8f6ef] px-2 py-1 rounded-full">
                    {events.length} {events.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  {events.map((event, index) => {
                    // Generate color based on subject for linking exams with sessions
                    const getExamColor = (subject: string) => {
                      const colors = [
                        'rgb(253, 231, 76)', // Yellow
                        'rgb(72, 86, 150)',  // Blue  
                        'rgb(250, 175, 205)', // Pink
                        'rgb(66, 191, 221)',  // Cyan
                      ];
                      
                      // Get all unique subjects from all events
                      const allSubjects = Array.from(new Set(Object.values(groupedEvents).flat().map(e => e.subject).filter(Boolean)));
                      const subjectIndex = allSubjects.indexOf(subject);
                      return colors[subjectIndex % colors.length];
                    };
                    
                    const eventColor = getExamColor(event.subject || '');
                    const isMainColor = eventColor === 'rgb(72, 86, 150)';
                    
                    return (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className={`group flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                        event.type === 'exam' 
                          ? `border-opacity-30 bg-opacity-10 hover:bg-opacity-20`
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
                        style={{ backgroundColor: eventColor }}
                      >
                        {event.type === 'exam' ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
                            className={`font-medium truncate ${
                              event.isCompleted ? 'line-through' : ''
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
                          
                          {event.startTime && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatTime(event.startTime)}
                              {event.endTime && ` - ${formatTime(event.endTime)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Click indicator */}
                      <div className="text-[#4a4a4a] opacity-40 group-hover:opacity-70 transition-opacity">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

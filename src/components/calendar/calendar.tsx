'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarEvents } from '@/hooks/use-calendar-data';

interface CalendarProps {
  onSessionClick?: (sessionId: string, date?: string) => void;
  onTaskClick?: (taskId: string) => void;
  onAddItemClick?: (date: string, position?: { x: number; y: number }) => void;
  sidebarOpen?: boolean;
  sidebarCollapsed?: boolean;
  onDatesSet?: (info: any) => void;
  onTodayInViewChange?: (inView: boolean) => void;
  blockedDays?: Set<string>;
}

interface ActivePopover {
  dateStr: string;
  x: number;
  y: number;
  count: number;
  hoursStr: string;
  sessions: any[];
}

const formatPopoverDate = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatSessionDuration = (startVal: any, endVal: any) => {
  try {
    const start = new Date(startVal);
    const end = new Date(endVal);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    return mins > 0 ? `${mins} min` : '';
  } catch {
    return '';
  }
};

const Calendar = forwardRef<any, CalendarProps>(({ 
  onSessionClick, 
  onTaskClick, 
  onAddItemClick, 
  sidebarOpen, 
  sidebarCollapsed, 
  onDatesSet,
  onTodayInViewChange,
  blockedDays 
}, ref) => {
  const router = useRouter();
  const { events: rawEvents, error, isLoading, mutate } = useCalendarEvents();
  const calendarRef = useRef<FullCalendar>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const currentMonthTitleRef = useRef('');
  const isTodayInViewRef = useRef(true);
  const hasInitialScrolledRef = useRef(false);
  const onAddItemClickRef = useRef(onAddItemClick);
  onAddItemClickRef.current = onAddItemClick;
  const onTodayInViewChangeRef = useRef(onTodayInViewChange);
  onTodayInViewChangeRef.current = onTodayInViewChange;
  const blockedDaysRef = useRef(blockedDays);
  blockedDaysRef.current = blockedDays;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const onDatesSetRef = useRef(onDatesSet);
  onDatesSetRef.current = onDatesSet;

  // State for hover/tap expanding popover card
  const [popover, setPopover] = useState<ActivePopover | null>(null);
  const popoverCloseTimer = useRef<NodeJS.Timeout | null>(null);

  const calendarViews = useMemo(() => ({
    continuousGrid: {
      type: 'dayGrid',
      visibleRange: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 8, 1);
        return { start, end };
      },
      monthStartFormat: { month: 'short' as const, day: 'numeric' as const },
    }
  }), []);

  // Helper to reliably find the active scrollable body scroller (not the fixed column header scroller)
  const getScroller = useCallback((): HTMLElement | null => {
    if (!calendarContainerRef.current) return null;
    const dayGridBody = calendarContainerRef.current.querySelector('.fc-daygrid-body');
    if (dayGridBody) {
      const scroller = dayGridBody.closest('.fc-scroller') as HTMLElement | null;
      if (scroller) return scroller;
    }
    const tdScroller = calendarContainerRef.current.querySelector('td .fc-scroller') as HTMLElement | null;
    if (tdScroller) return tdScroller;
    const liquidScroller = calendarContainerRef.current.querySelector('.fc-scroller-liquid-absolute') as HTMLElement | null;
    if (liquidScroller) return liquidScroller;
    const all = calendarContainerRef.current.querySelectorAll('.fc-scroller');
    return (all[all.length - 1] as HTMLElement) || null;
  }, []);

  // Check if today is currently in view inside the scroller viewport
  const checkTodayInView = useCallback(() => {
    const scroller = getScroller();
    if (!scroller || !calendarContainerRef.current) return true;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayCell = calendarContainerRef.current.querySelector(
      `.fc-daygrid-body [data-date="${todayStr}"], .fc-daygrid-body .fc-daygrid-day.fc-day-today`
    ) as HTMLElement | null;
    if (!todayCell) return true;

    const scrollerRect = scroller.getBoundingClientRect();
    const cellRect = todayCell.getBoundingClientRect();

    // Today is in view if its top/bottom overlaps the visible scroller window
    return cellRect.bottom >= scrollerRect.top + 20 && cellRect.top <= scrollerRect.bottom - 20;
  }, [getScroller]);

  // Smooth scroll to a date in the continuous calendar
  const scrollToDate = useCallback((target: Date | string, smooth = true) => {
    const scroller = getScroller();
    if (!scroller || !calendarContainerRef.current) return;

    let targetDateStr = '';
    if (typeof target === 'string') {
      targetDateStr = target.slice(0, 10);
    } else {
      const y = target.getFullYear();
      const m = String(target.getMonth() + 1).padStart(2, '0');
      const d = String(target.getDate()).padStart(2, '0');
      targetDateStr = `${y}-${m}-${d}`;
    }

    const todayStr = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    let cell: HTMLElement | null = null;
    if (targetDateStr === todayStr) {
      cell = calendarContainerRef.current.querySelector(
        `.fc-daygrid-body [data-date="${todayStr}"], .fc-daygrid-body .fc-daygrid-day.fc-day-today`
      ) as HTMLElement | null;
    }
    if (!cell) {
      cell = calendarContainerRef.current.querySelector(`.fc-daygrid-body [data-date="${targetDateStr}"]`) as HTMLElement | null;
    }
    if (!cell) {
      const monthPrefix = targetDateStr.slice(0, 7);
      cell = calendarContainerRef.current.querySelector(`.fc-daygrid-body [data-date^="${monthPrefix}"]`) as HTMLElement | null;
    }

    if (cell) {
      const scrollerRect = scroller.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      // Distance between top of cell and top of scroller viewport
      const offsetTop = scroller.scrollTop + (cellRect.top - scrollerRect.top) - 10;
      
      scroller.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, [getScroller]);

  // Navigate forward/backward by month smoothly
  const navigateMonth = useCallback((delta: number) => {
    const scroller = getScroller();
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const sampleY = scrollerRect.top + 70;
    const sampleX = scrollerRect.left + scrollerRect.width / 2;
    const el = document.elementFromPoint(sampleX, sampleY);
    const dayCell = el?.closest('.fc-daygrid-day') as HTMLElement | null;

    let baseDate = new Date();
    if (dayCell) {
      const dStr = dayCell.getAttribute('data-date');
      if (dStr) {
        const [y, m] = dStr.split('-').map(Number);
        baseDate = new Date(y, m - 1, 1);
      }
    }

    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1);
    scrollToDate(targetDate, true);
  }, [getScroller, scrollToDate]);

  useImperativeHandle(ref, () => ({
    getApi: () => calendarRef.current?.getApi(),
    scrollToToday: () => scrollToDate(new Date(), true),
    scrollToNextMonth: () => navigateMonth(1),
    scrollToPrevMonth: () => navigateMonth(-1),
    scrollToDate: (date: Date | string, smooth = true) => scrollToDate(date, smooth),
  }));

  // Auto-scroll to today ONLY on initial mount (runs once)
  useEffect(() => {
    if (hasInitialScrolledRef.current) return;
    let timer: NodeJS.Timeout | null = null;
    let attempts = 0;

    const tryScroll = () => {
      if (hasInitialScrolledRef.current) return;
      const scroller = getScroller();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayCell = calendarContainerRef.current?.querySelector(
        `.fc-daygrid-body [data-date="${todayStr}"], .fc-daygrid-body .fc-daygrid-day.fc-day-today`
      );

      if (scroller && todayCell) {
        hasInitialScrolledRef.current = true;
        scrollToDate(new Date(), false);
        setTimeout(() => {
          const inView = checkTodayInView();
          isTodayInViewRef.current = inView;
          onTodayInViewChangeRef.current?.(inView);
        }, 80);
      } else if (attempts < 15) {
        attempts++;
        timer = setTimeout(tryScroll, 100);
      }
    };

    tryScroll();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [getScroller, scrollToDate, checkTodayInView]);

  // Update current month title dynamically and check if today is in view when user scrolls
  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const currentScroller = scroller || getScroller();
        if (!currentScroller) return;

        // Check if today cell is currently visible in the scroller viewport
        const todayVisible = checkTodayInView();
        if (todayVisible !== isTodayInViewRef.current) {
          isTodayInViewRef.current = todayVisible;
          onTodayInViewChangeRef.current?.(todayVisible);
        }

        const scrollerRect = currentScroller.getBoundingClientRect();
        const sampleY = scrollerRect.top + 70;
        const sampleX = scrollerRect.left + scrollerRect.width / 2;
        const el = document.elementFromPoint(sampleX, sampleY);
        const dayCell = el?.closest('.fc-daygrid-day') as HTMLElement | null;
        if (dayCell) {
          const dateStr = dayCell.getAttribute('data-date');
          if (dateStr) {
            const [y, m] = dateStr.split('-');
            const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            const title = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (title && title !== currentMonthTitleRef.current) {
              currentMonthTitleRef.current = title;
              onDatesSetRef.current?.({ view: { title } });
            }
          }
        }
      });
    };

    const attachScroller = () => {
      scroller = getScroller();
      if (scroller) {
        scroller.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });
        return true;
      }
      return false;
    };

    let retryTimer: NodeJS.Timeout | null = null;
    let retryTimer2: NodeJS.Timeout | null = null;

    if (!attachScroller()) {
      retryTimer = setTimeout(attachScroller, 150);
      retryTimer2 = setTimeout(attachScroller, 400);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (retryTimer2) clearTimeout(retryTimer2);
      if (scroller) {
        scroller.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleScroll);
    };
  }, [checkTodayInView, getScroller]);

  // Close popover when clicking anywhere outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const popoverEl = document.getElementById('session-group-popover');
      if (popoverEl && popoverEl.contains(e.target as Node)) {
        return;
      }
      setPopover(null);
    };

    if (popover) {
      document.addEventListener('pointerdown', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
    };
  }, [popover]);

  const handleGroupMouseEnter = (e: any, props: any) => {
    if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
    const targetEl = e.currentTarget || e.target;
    const rect = targetEl?.getBoundingClientRect ? targetEl.getBoundingClientRect() : { left: e.clientX || 100, width: 0, bottom: e.clientY || 100, top: e.clientY || 100 };
    const popoverWidth = 320;
    let x = rect.left + rect.width / 2 - popoverWidth / 2;
    if (x + popoverWidth > window.innerWidth - 12) {
      x = window.innerWidth - popoverWidth - 12;
    }
    if (x < 12) x = 12;

    let y = rect.bottom + 8;
    if (y + 260 > window.innerHeight) {
      y = Math.max(12, rect.top - 240);
    }

    setPopover({
      dateStr: props.dateStr,
      x,
      y,
      count: props.count,
      hoursStr: props.hoursStr,
      sessions: props.sessions,
    });
  };

  const handleGroupMouseLeave = () => {
    popoverCloseTimer.current = setTimeout(() => {
      setPopover(null);
    }, 220);
  };

  const handleGroupClick = (e: any, props: any) => {
    e.stopPropagation?.();
    if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
    if (popover && popover.dateStr === props.dateStr) {
      setPopover(null);
      return;
    }
    handleGroupMouseEnter(e, props);
  };

  const handleEventDrop = async (info: any) => {
    const sessionId = info.event.extendedProps?.sessionId;
    if (!sessionId) {
      info.revert();
      return;
    }

    const oldStart = info.oldEvent.start as Date;
    const oldEnd = info.oldEvent.end as Date | null;
    const newStart = info.event.start as Date;
    const duration = oldEnd ? oldEnd.getTime() - oldStart.getTime() : 60 * 60 * 1000;
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
      mutate();
    } catch (err) {
      console.error('Session drag failed:', err);
      info.revert();
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

  // Aggregate daily study sessions into consolidated summary cards with color-coded dot badges
  const processedEvents = useMemo(() => {
    if (!mounted || !rawEvents || rawEvents.length === 0) return [];
    const rawEventsList: any[] = rawEvents;

    const exams: any[] = [];
    const tasks: any[] = [];
    const sessionsByDate: Record<string, any[]> = {};

    for (const event of rawEventsList) {
      if (event.extendedProps?.type === 'exam') {
        exams.push(event);
      } else if (event.extendedProps?.type === 'task') {
        tasks.push(event);
      } else if (event.extendedProps?.type === 'session') {
        const d = new Date(event.start);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${day}`;

        if (!sessionsByDate[dateKey]) sessionsByDate[dateKey] = [];
        sessionsByDate[dateKey].push(event);
      }
    }

    const result: any[] = [...exams, ...tasks];

    for (const [dateStr, dateSessions] of Object.entries(sessionsByDate)) {
      dateSessions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      if (dateSessions.length <= 3) {
        result.push(...dateSessions);
        continue;
      }

      const totalMinutes = dateSessions.reduce((acc, s) => {
        const dur = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000;
        return acc + (isNaN(dur) || dur <= 0 ? 60 : dur);
      }, 0);

      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      const hoursStr = Number.isInteger(hours) ? `${hours}h` : `${hours}h`;
      const count = dateSessions.length;
      const cardTitle = `${count} ${count === 1 ? 'block' : 'blocks'} (${hoursStr})`;

      const dots = dateSessions.map(s => ({
        color: s.extendedProps?.color || s.borderColor || '#3b82f6',
        subject: s.extendedProps?.subject || s.title,
        isCompleted: s.extendedProps?.isCompleted || false,
      }));

      result.push({
        id: `session-group-${dateStr}`,
        title: cardTitle,
        start: `${dateStr}T09:00:00`,
        allDay: true,
        editable: false,
        extendedProps: {
          type: 'session-group',
          dateStr,
          count,
          hoursStr,
          totalMinutes,
          sessions: dateSessions,
          dots,
        }
      });
    }

    return result;
  }, [rawEvents]);

  // Silently re-evaluate day classes when blockedDays updates without tearing down FullCalendar DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current) {
        const api = calendarRef.current.getApi() as any;
        if (typeof api?.render === 'function') {
          try {
            api.render();
          } catch {}
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [blockedDays]);

  if (error && processedEvents.length === 0) {
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

  if (!mounted || (isLoading && processedEvents.length === 0)) {
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

  return (
    <div ref={calendarContainerRef} className="h-full bg-white dark:bg-slate-900 relative">
      <FullCalendar
        key="main-fullcalendar"
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="continuousGrid"
        views={calendarViews}
        headerToolbar={false}
        events={processedEvents}
        editable={false}
        height="100%"
        dayMaxEvents={4}
        datesSet={(info) => onDatesSetRef.current?.(info)}
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
        dayHeaderFormat={{ weekday: 'short' }}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          const type = info.event.extendedProps?.type;
          if (type === 'exam') {
            const examId = info.event.extendedProps?.examId;
            router.push(examId ? `/exams/${examId}` : '/exams');
          } else if (type === 'session') {
            const sessionId = info.event.extendedProps?.sessionId;
            const start = info.event.start;
            let dateStr: string | undefined = undefined;
            if (start) {
              const d = new Date(start);
              dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            if (sessionId && onSessionClick) {
              onSessionClick(sessionId, dateStr);
            }
          } else if (type === 'session-group') {
            const sessions = info.event.extendedProps?.sessions || [];
            const dateStr = info.event.extendedProps?.dateStr;
            if (sessions.length === 1 && onSessionClick) {
              onSessionClick(sessions[0].extendedProps?.sessionId, dateStr);
            } else {
              handleGroupClick(info.jsEvent, info.event.extendedProps);
            }
          } else if (type === 'task' && info.event.extendedProps?.taskId) {
            if (onTaskClick) {
              onTaskClick(info.event.extendedProps.taskId);
            }
          }
        }}
        eventContent={(eventInfo) => {
          const type = eventInfo.event.extendedProps?.type;

          // 1. DISTINCT EXAM DEADLINE (Outline pill badge with flag icon)
          if (type === 'exam') {
            const examColor = eventInfo.event.extendedProps?.color || '#ef4444';
            const isCompleted = eventInfo.event.extendedProps?.isCompleted;
            const subject = eventInfo.event.extendedProps?.subject || eventInfo.event.title.replace(/^Exam:\s*/i, '');

            return (
              <div
                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md border-2 font-bold text-xs select-none transition-all shadow-xs ${
                  isCompleted
                    ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 line-through opacity-80'
                    : 'bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white hover:scale-[1.01]'
                }`}
                style={{
                  borderColor: isCompleted ? undefined : examColor,
                  boxShadow: isCompleted ? undefined : `0 2px 6px ${examColor}25`,
                }}
                title={`Official Exam Deadline: ${subject}`}
              >
                {/* Distinct Flag Icon badge */}
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-[9px] shadow-xs"
                  style={{ backgroundColor: isCompleted ? '#10b981' : examColor }}
                >
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M4 2v20M4 4h14l-3 5 3 5H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* EXAM Badge */}
                <span
                  className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded shrink-0 text-slate-700 dark:text-slate-200"
                  style={{
                    backgroundColor: `${examColor}20`,
                  }}
                >
                  EXAM
                </span>

                {/* Subject Name */}
                <span className="text-[11px] font-extrabold truncate flex-1 tracking-tight">
                  {subject}
                </span>
              </div>
            );
          }

          // 2. AGGREGATED DAILY STUDY SESSIONS CARD ("3 blocks (4.5h)" with dot badges)
          if (type === 'session-group') {
            const { count, hoursStr, dots } = eventInfo.event.extendedProps;
            const isAllCompleted = dots.length > 0 && dots.every((d: any) => d.isCompleted);

            return (
              <div
                onMouseEnter={(e) => handleGroupMouseEnter(e, eventInfo.event.extendedProps)}
                onMouseLeave={handleGroupMouseLeave}
                onClick={(e) => handleGroupClick(e, eventInfo.event.extendedProps)}
                className={`group/card w-full flex items-center justify-between gap-1 px-2 py-1 rounded-md border text-xs shadow-xs cursor-pointer select-none transition-all ${
                  isAllCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-100/95 hover:bg-slate-200/95 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
                title="Click or hover to view study blocks"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <svg className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-[11px] font-semibold truncate">
                    {count} {count === 1 ? 'block' : 'blocks'} ({hoursStr})
                  </span>
                </div>

                {/* Color-coded dot badges */}
                <div className="flex items-center -space-x-1 shrink-0 ml-1">
                  {dots.slice(0, 5).map((dot: any, idx: number) => (
                    <span
                      key={idx}
                      className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 shadow-xs shrink-0 transition-transform group-hover/card:scale-110"
                      style={{ backgroundColor: dot.color }}
                      title={dot.subject}
                    />
                  ))}
                  {dots.length > 5 && (
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 ml-0.5">
                      +{dots.length - 5}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // 3. INDIVIDUAL SESSION EVENT (rendered when <= 3 sessions per day)
          if (type === 'session') {
            const { isCompleted, color, shortTitle } = eventInfo.event.extendedProps;
            
            return (
              <div
                className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium shadow-xs select-none overflow-hidden cursor-pointer hover:shadow-sm hover:scale-[1.01] transition-all ${
                  isCompleted
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 opacity-80'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
                style={{
                  borderLeftColor: color,
                  borderLeftWidth: '3px'
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: isCompleted ? '#10b981' : color }}
                />
                <span className="truncate flex-1" title={eventInfo.event.title}>
                  {eventInfo.event.title}
                </span>
                {!isCompleted && (() => {
                  const start = eventInfo.event.start;
                  const end = eventInfo.event.end;
                  if (!start || !end) return null;
                  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
                  if (mins <= 0) return null;
                  return (
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                      {mins}m
                    </span>
                  );
                })()}
              </div>
            );
          }

          // 4. TASK EVENT
          if (type === 'task') {
            const isCompleted = eventInfo.event.extendedProps?.isCompleted;
            return (
              <div
                className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium shadow-xs select-none ${
                  isCompleted
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 line-through opacity-70'
                    : 'border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'
                }`}
              >
                <span className="text-[10px]">📌</span>
                <span className="truncate">{eventInfo.event.title}</span>
              </div>
            );
          }

          return null;
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
            if (dayTop.querySelector('.fc-add-btn')) return;

            const addButton = document.createElement('button');
            addButton.innerHTML = '+';
            addButton.className = 'fc-add-btn transition-opacity hover:bg-gray-100 dark:hover:bg-slate-800 rounded px-1.5 ml-1 text-sm font-medium';
            addButton.title = 'Add exam or event';
            addButton.style.opacity = '0';

            dayTop.appendChild(addButton);

            dayCell.addEventListener('mouseenter', () => {
              addButton.style.opacity = '1';
            });
            dayCell.addEventListener('mouseleave', () => {
              addButton.style.opacity = '0';
            });

            addButton.addEventListener('pointerdown', (e) => {
              e.stopPropagation();
              e.preventDefault();
            });

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
      />

      {/* EXPANDING POPOVER FOR AGGREGATED DAILY STUDY BLOCKS */}
      {popover && (
        <div
          id="session-group-popover"
          style={{
            position: 'fixed',
            left: `${popover.x}px`,
            top: `${popover.y}px`,
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
          }}
          onMouseLeave={() => {
            setPopover(null);
          }}
          className="w-72 sm:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700/90 p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {formatPopoverDate(popover.dateStr)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {popover.count} study {popover.count === 1 ? 'block' : 'blocks'} • {popover.hoursStr} total
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
              Study Sprint
            </span>
          </div>

          {/* Sessions List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {popover.sessions.map((session, idx) => {
              const color = session.extendedProps?.color || '#3b82f6';
              const isCompleted = session.extendedProps?.isCompleted;
              const timeStr = formatSessionDuration(session.start, session.end);
              const shortTitle = session.extendedProps?.shortTitle || session.title;
              const subject = session.extendedProps?.subject || session.title;

              return (
                <div
                  key={session.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopover(null);
                    if (onSessionClick && session.extendedProps?.sessionId) {
                      onSessionClick(session.extendedProps.sessionId, popover.dateStr);
                    }
                  }}
                  className="group flex items-start gap-2.5 p-2 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 shadow-xs"
                    style={{ backgroundColor: isCompleted ? '#10b981' : color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {subject}
                      </span>
                      {timeStr && (
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                          {timeStr}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {shortTitle}
                    </p>
                  </div>

                  {isCompleted ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      ✓
                    </span>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <style jsx global>{`
        .fc-daygrid-event {
          background: transparent !important;
          border: none !important;
          margin-top: 1.5px !important;
          margin-bottom: 1.5px !important;
        }
        .fc-daygrid-event:hover {
          background: transparent !important;
        }
        .fc-daygrid-event-dot {
          display: none !important;
        }
        .fc-daygrid-event-harness {
          margin-top: 1.5px !important;
        }
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
        .fc-scroller {
          -webkit-overflow-scrolling: touch !important;
        }
        .fc-scroller::-webkit-scrollbar {
          width: 6px;
        }
        .fc-scroller::-webkit-scrollbar-track {
          background: transparent;
        }
        .fc-scroller::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.35);
          border-radius: 9999px;
        }
        .fc-scroller::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.65);
        }
        :global(.dark) .fc-scroller::-webkit-scrollbar-thumb {
          background: rgba(71, 85, 105, 0.45);
        }
        :global(.dark) .fc-scroller::-webkit-scrollbar-thumb:hover {
          background: rgba(71, 85, 105, 0.75);
        }
        .fc-daygrid-day-frame {
          min-height: 108px !important;
          position: relative;
        }
        .fc-daygrid-month-start .fc-daygrid-day-number {
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          background-color: rgba(158, 194, 154, 0.22) !important;
          color: #4b6149 !important;
          border-radius: 6px !important;
          padding: 2px 7px !important;
          letter-spacing: -0.01em;
          width: auto !important;
          height: auto !important;
        }
        :global(.dark) .fc-daygrid-month-start .fc-daygrid-day-number {
          background-color: rgba(158, 194, 154, 0.25) !important;
          color: #d3ebd1 !important;
        }
        .fc-day-today {
          background-color: rgba(158, 194, 154, 0.1) !important;
        }
        :global(.dark) .fc-day-today {
          background-color: rgba(158, 194, 154, 0.14) !important;
        }
        .fc-day-today .fc-daygrid-day-number {
          background-color: #9EC29A !important;
          color: #1e293b !important;
          border-radius: 6px !important;
          padding: 2px 7px !important;
          font-weight: 800 !important;
        }
        :global(.dark) .fc-day-today .fc-daygrid-day-number {
          background-color: #9EC29A !important;
          color: #0f172a !important;
        }
        .fc-daygrid-month-start {
          box-shadow: inset 2.5px 0 0 0 #9EC29A !important;
        }
        :global(.dark) .fc-daygrid-month-start {
          box-shadow: inset 2.5px 0 0 0 #9EC29A !important;
        }
        .fc .fc-scrollgrid-section-header {
          position: sticky !important;
          top: 0 !important;
          z-index: 20 !important;
        }
        .fc .fc-scrollgrid-section-header > * {
          background: #ffffff !important;
        }
        :global(.dark) .fc .fc-scrollgrid-section-header > * {
          background: #0f172a !important;
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

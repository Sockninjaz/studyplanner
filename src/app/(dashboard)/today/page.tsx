'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useCalendarEvents } from '@/hooks/use-calendar-data';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { calculateFinishTimeRounded } from '@/lib/dateUtils';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const preprocessMath = (content: string) => {
  if (!content) return '';
  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => `$${p1}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => `$$${p1}$$`);
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  text: string;
  completed: boolean;
  sessionsCompleted: number;
}

interface StudySession {
  _id: string;
  title: string;
  shortTitle?: string;
  subject: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  tasks: Task[];
  exam?: {
    _id: string;
    subject: string;
    color?: string;
    date: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXAM_COLORS = [
  'rgb(253, 231, 76)',
  'rgb(72, 86, 150)',
  'rgb(250, 175, 205)',
  'rgb(66, 191, 221)',
  'rgb(167, 139, 250)',
  'rgb(52, 211, 153)',
  'rgb(251, 146, 60)',
  'rgb(45, 212, 191)',
];

function getExamColor(exam?: { _id: string; color?: string }): string {
  if (!exam) return 'rgb(100, 116, 139)';
  if (exam.color) return exam.color;
  let hash = 0;
  for (let i = 0; i < exam._id.length; i++) {
    hash = ((hash << 5) - hash) + exam._id.charCodeAt(i);
    hash |= 0;
  }
  return EXAM_COLORS[Math.abs(hash) % EXAM_COLORS.length];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const exam = new Date(dateStr);
  return Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatNextDateShort(dateStr: string, locale: string = 'en-GB'): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudyHubPage() {
  const { t, locale } = useLanguage();
  const dateLocale = locale === 'nl' ? 'nl-NL' : 'en-US';

  // Prevent SSR/client hydration mismatch for cached SWR calendar data
  const [mounted, setMounted] = useState(false);
  // Live clock (minute resolution) for the "if you start now you'll be done at" estimate
  const [nowMs, setNowMs] = useState<number>(0);
  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Selected date for looking ahead / backwards (defaults to today; URL ?date= is applied on client mount in useEffect)
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);

  // Shared cached calendar events to show which days across the month have scheduled sessions
  const { data: calendarData } = useCalendarEvents();

  const sessionsByDateMap = useMemo(() => {
    const map = new Map<string, { count: number; colors: string[] }>();
    if (mounted && calendarData?.data) {
      for (const ev of calendarData.data) {
        if (ev.extendedProps?.type === 'session' && ev.start) {
          const d = new Date(ev.start);
          const dStr = getLocalDateString(d);
          const existing = map.get(dStr) || { count: 0, colors: [] };
          existing.count++;
          const col = ev.extendedProps?.color || '#6366f1';
          if (!existing.colors.includes(col)) existing.colors.push(col);
          map.set(dStr, existing);
        }
      }
    }
    return map;
  }, [mounted, calendarData]);

  // Next upcoming study date relative to selectedDate
  const nextStudyDate = useMemo(() => {
    if (!mounted) return null;
    const sorted = Array.from(sessionsByDateMap.keys()).sort();
    return sorted.find(d => d > selectedDate) || null;
  }, [mounted, sessionsByDateMap, selectedDate]);

  // Day strip cards: 21 days window (past 3 days to 17 days in future)
  const dayStripDays = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayName: string;
      dayNum: number;
      monthShort: string;
      isToday: boolean;
      isSelected: boolean;
      hasSessions: boolean;
      sessionCount: number;
      sessionColors: string[];
    }> = [];

    const todayStr = getLocalDateString();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);

    for (let i = 0; i < 21; i++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + i);
      const curStr = getLocalDateString(cur);
      const info = sessionsByDateMap.get(curStr);

      days.push({
        dateStr: curStr,
        dayName: cur.toLocaleDateString(dateLocale, { weekday: 'short' }),
        dayNum: cur.getDate(),
        monthShort: cur.toLocaleDateString(dateLocale, { month: 'short' }),
        isToday: curStr === todayStr,
        isSelected: curStr === selectedDate,
        hasSessions: !!(info && info.count > 0),
        sessionCount: info?.count || 0,
        sessionColors: info?.colors || [],
      });
    }

    if (!days.some(d => d.dateStr === selectedDate)) {
      const cur = parseLocalDateString(selectedDate);
      const info = sessionsByDateMap.get(selectedDate);
      days.push({
        dateStr: selectedDate,
        dayName: cur.toLocaleDateString(dateLocale, { weekday: 'short' }),
        dayNum: cur.getDate(),
        monthShort: cur.toLocaleDateString(dateLocale, { month: 'short' }),
        isToday: selectedDate === todayStr,
        isSelected: true,
        hasSessions: !!(info && info.count > 0),
        sessionCount: info?.count || 0,
        sessionColors: info?.colors || [],
      });
      days.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    return days;
  }, [selectedDate, sessionsByDateMap, dateLocale]);

  // Auto-scroll selected day into view in the horizontal strip
  useEffect(() => {
    if (dayStripRef.current) {
      const el = dayStripRef.current.querySelector('[data-selected="true"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate]);

  const dateHeadingInfo = useMemo(() => {
    const todayStr = getLocalDateString();
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = getLocalDateString(tom);
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = getLocalDateString(yest);

    const dateObj = parseLocalDateString(selectedDate);
    const fullDate = dateObj.toLocaleDateString(dateLocale, {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    if (selectedDate === todayStr) {
      return { main: t('common.today'), date: fullDate, isToday: true };
    }
    if (selectedDate === tomorrowStr) {
      return { main: t('common.tomorrow'), date: fullDate, isToday: false };
    }
    if (selectedDate === yesterdayStr) {
      return { main: t('common.yesterday'), date: fullDate, isToday: false };
    }
    return {
      main: dateObj.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' }),
      date: fullDate,
      isToday: false,
    };
  }, [selectedDate, dateLocale, t]);

  const handleSelectDate = (newDate: string) => {
    setSelectedDate(newDate);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('date', newDate);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url.toString());
    }
    if (selectedSession?.startTime) {
      const curSessionDate = getLocalDateString(new Date(selectedSession.startTime));
      if (curSessionDate !== newDate) {
        setSelectedSession(null);
        setMobileView('list');
      }
    }
  };

  const handlePrevDay = () => {
    const cur = parseLocalDateString(selectedDate);
    cur.setDate(cur.getDate() - 1);
    handleSelectDate(getLocalDateString(cur));
  };

  const handleNextDay = () => {
    const cur = parseLocalDateString(selectedDate);
    cur.setDate(cur.getDate() + 1);
    handleSelectDate(getLocalDateString(cur));
  };

  const handleJumpToday = () => {
    handleSelectDate(getLocalDateString(new Date()));
  };

  const handleFindNextStudyDay = () => {
    if (nextStudyDate) {
      handleSelectDate(nextStudyDate);
    }
  };

  // Session list
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);

  const [sessionDuration, setSessionDuration] = useState(30); // minutes from user prefs

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(30 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const endTimeRef = useRef<number | null>(null);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [savingTasks, setSavingTasks] = useState(false);
  const saveTasksDebounce = useRef<NodeJS.Timeout | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const userScrolledUp = useRef(false);

  // ── Persist state to localStorage ─────────────────────────────────────────
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  // 1. Load timer state immediately
  useEffect(() => {
    try {
      const saved = localStorage.getItem('todayPageState');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.timerSeconds !== undefined) setTimerSeconds(state.timerSeconds);
        if (state.timerRunning !== undefined) setTimerRunning(state.timerRunning);
        if (state.timerFinished !== undefined) setTimerFinished(state.timerFinished);
        if (state.endTime) endTimeRef.current = state.endTime;
        
        if (state.endTime && state.timerRunning) {
           const remaining = Math.ceil((state.endTime - Date.now()) / 1000);
           if (remaining > 0) {
             setTimerSeconds(remaining);
           } else {
             setTimerSeconds(0);
             setTimerRunning(false);
             setTimerFinished(true);
             endTimeRef.current = null;
           }
        }
      }
    } catch(e) {}
    setIsInitialized(true);
  }, []);

  // 2. Restore selected session after sessions list is loaded
  useEffect(() => {
    if (!isInitialized || loadingSessions) return;
    if (!isRestored) {
      try {
        const saved = localStorage.getItem('todayPageState');
        if (saved) {
          const state = JSON.parse(saved);
          if (state.selectedSessionId && !selectedSession && typeof window !== 'undefined' && !window.location.search.includes('session=')) {
            const found = sessions.find(s => s._id === state.selectedSessionId);
            if (found) {
              setSelectedSession(found);
              setTasks(found.tasks || []);
            }
          }
        }
      } catch(e) {}
      setIsRestored(true);
    }
  }, [isInitialized, loadingSessions, sessions, selectedSession, isRestored]);

  // 3. Save state only after restore phase is complete
  useEffect(() => {
    if (!isRestored) return;
    localStorage.setItem('todayPageState', JSON.stringify({
      selectedSessionId: selectedSession?._id || null,
      timerSeconds,
      timerRunning,
      timerFinished,
      endTime: endTimeRef.current
    }));
  }, [isRestored, selectedSession, timerSeconds, timerRunning, timerFinished]);

  // ── Fetch sessions for selected date ─────────────────────────────────────────

  const fetchSessions = useCallback(async (targetDate?: string) => {
    setLoadingSessions(true);
    const dateQuery = targetDate || selectedDate;
    try {
      const res = await fetch(`/api/sessions?date=${dateQuery}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSessions(selectedDate);
  }, [selectedDate]);

  // ── Fetch user preferences for session duration ─────────────────────────────

  useEffect(() => {
    fetchSessions();
    const loadPrefs = async () => {
      try {
        const saved = localStorage.getItem('userPreferences');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.session_duration) setSessionDuration(p.session_duration);
        }
        const res = await fetch('/api/user/preferences');
        if (res.ok) {
          const data = await res.json();
          if (data.session_duration) setSessionDuration(data.session_duration);
        }
      } catch {}
    };
    loadPrefs();

    if (typeof window !== 'undefined') {
      const handleUpdate = () => {
        fetchSessions();
        loadPrefs();
      };
      window.addEventListener('calendarUpdated', handleUpdate);
      window.addEventListener('preferencesUpdated', handleUpdate);

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session');
      const dateParam = params.get('date');
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        setSelectedDate(dateParam);
      }
      if (sessionId) {
        const fetchSpecificSession = async () => {
          try {
            const res = await fetch(`/api/sessions/${sessionId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.data) {
                // To avoid dependency cycle, we set it directly if possible, or wait for handleSelectSession
                setSelectedSession(data.data);
                setTasks(data.data.tasks || []);
                setMobileView('session');

                if (data.data.startTime) {
                  const sDate = getLocalDateString(new Date(data.data.startTime));
                  setSelectedDate(sDate);
                  fetchSessions(sDate);
                }
                
                // Initialize timer using localStorage fallback if state isn't ready
                let duration = Math.min(90, Math.max(30, sessionDuration || 45));
                if (data.data.startTime && data.data.endTime) {
                  const rawMins = Math.round((new Date(data.data.endTime).getTime() - new Date(data.data.startTime).getTime()) / (1000 * 60));
                  if (rawMins > 0) duration = Math.min(90, Math.max(30, rawMins));
                } else {
                  try {
                    const saved = localStorage.getItem('userPreferences');
                    if (saved) {
                      const p = JSON.parse(saved);
                      if (p.session_duration) duration = Math.min(90, Math.max(30, p.session_duration));
                    }
                  } catch {}
                }
                setTimerSeconds(duration * 60);
                setTimerRunning(false);
                setTimerFinished(false);
                endTimeRef.current = null;

                // Load chat history for this exam
                if (data.data.exam?._id) {
                  setFetchingHistory(true);
                  setChatMessages([]);
                  try {
                    const chatRes = await fetch(`/api/chat/history?examId=${data.data.exam._id.toString()}`);
                    if (chatRes.ok) {
                      const chatData = await chatRes.json();
                      if (chatData.messages) {
                        const formatted = chatData.messages
                          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
                          .map((m: any, i: number) => ({
                            id: m.id || i.toString(),
                            role: m.role,
                            content: m.content
                          }));
                        setChatMessages(formatted);
                      }
                    }
                  } catch (e) {
                    console.error('Failed to fetch chat history', e);
                  } finally {
                    setFetchingHistory(false);
                    setTimeout(() => {
                      if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                      }
                    }, 100);
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to auto-select session', e);
          }
        };
        fetchSpecificSession();
      }

      return () => {
        window.removeEventListener('calendarUpdated', handleUpdate);
        window.removeEventListener('preferencesUpdated', handleUpdate);
      };
    }
  }, [fetchSessions]);

  // ── Select a session ────────────────────────────────────────────────────────

  const handleSelectSession = useCallback(async (session: StudySession) => {
    setSelectedSession(session);
    
    // Calculate real session duration from start and end times, safely bounded (30m to 90m max)
    let actualDuration = Math.min(90, Math.max(30, sessionDuration || 45));
    if (session.startTime && session.endTime) {
      const rawMins = Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60));
      if (rawMins > 0) {
        actualDuration = Math.min(90, Math.max(30, rawMins));
      }
    }
    
    setTimerSeconds(actualDuration * 60);
    setTimerRunning(false);
    setTimerFinished(false);
    endTimeRef.current = null;
    setTasks(session.tasks || []);

    // Fetch fresh session data (with tasks)
    try {
      const res = await fetch(`/api/sessions/${session._id}`);
      if (res.ok) {
        const data = await res.json();
        const fresh = data.data as StudySession;
        setSelectedSession(fresh);
        setTasks(fresh.tasks || []);
      }
    } catch {}

    // Load chat history for this exam
    if (session.exam?._id) {
      setFetchingHistory(true);
      setChatMessages([]);
      try {
        const res = await fetch(`/api/chat/history?examId=${session.exam._id.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages) {
            const formatted: ChatMessage[] = data.messages
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any, i: number) => ({
                id: m._id || String(i),
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }));
            setChatMessages(formatted);
          }
        }
      } catch {} finally {
        setFetchingHistory(false);
      }
    }
  }, [sessionDuration]);

  // ── Timer logic ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!timerRunning) return;

    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + timerSeconds * 1000;
    }

    const interval = setInterval(() => {
      if (endTimeRef.current !== null) {
        const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimerSeconds(0);
          setTimerRunning(false);
          setTimerFinished(true);
          endTimeRef.current = null;
        } else {
          setTimerSeconds(remaining);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [timerRunning]);

  const currentActualDuration = selectedSession?.startTime && selectedSession?.endTime 
    ? Math.max(1, Math.round((new Date(selectedSession.endTime).getTime() - new Date(selectedSession.startTime).getTime()) / (1000 * 60)))
    : sessionDuration;

  const startTimer = () => {
    if (timerFinished) {
      setTimerSeconds(currentActualDuration * 60);
      setTimerFinished(false);
    }
    endTimeRef.current = Date.now() + timerSeconds * 1000;
    setTimerRunning(true);
  };

  const pauseTimer = () => {
    setTimerRunning(false);
    endTimeRef.current = null;
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerFinished(false);
    endTimeRef.current = null;
    setTimerSeconds(currentActualDuration * 60);
  };

  const timerProgress = selectedSession
    ? ((currentActualDuration * 60 - timerSeconds) / (currentActualDuration * 60)) * 100
    : 0;

  // Remaining (unfinished) study minutes today, and the time you'd finish if you started right now,
  // rounded UP to the next half hour (e.g. 17:12 -> 17:30, 17:30 -> 17:30, 17:31 -> 18:00).
  const dayFinishEstimate = useMemo(() => {
    if (!mounted || !nowMs || !dateHeadingInfo.isToday) return null;
    let remainingMins = 0;
    let unfinishedCount = 0;

    for (const s of sessions) {
      if (s.isCompleted) continue;
      unfinishedCount++;
      if (selectedSession && s._id === selectedSession._id && timerSeconds > 0) {
        remainingMins += Math.max(1, Math.ceil(timerSeconds / 60));
      } else {
        let mins = 0;
        if (s.startTime && s.endTime) {
          mins = Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000);
        }
        if (!mins || mins <= 0) {
          mins = sessionDuration || 45;
        }
        remainingMins += Math.min(90, Math.max(30, mins));
      }
    }

    if (remainingMins <= 0 || unfinishedCount === 0) return null;
    const time = calculateFinishTimeRounded(remainingMins, nowMs);
    return { remainingMins, time, unfinishedCount };
  }, [mounted, nowMs, dateHeadingInfo.isToday, sessions, selectedSession, timerSeconds, sessionDuration]);

  // Finish estimate for currently selected session (rounded UP to the next half hour)
  const sessionFinishEstimate = useMemo(() => {
    if (!mounted || !nowMs || !selectedSession || selectedSession.isCompleted) return null;
    const remainingSecs = timerSeconds > 0 ? timerSeconds : (currentActualDuration * 60);
    if (remainingSecs <= 0) return null;
    const time = calculateFinishTimeRounded(remainingSecs, nowMs, true);
    return { time, isRunning: timerRunning };
  }, [mounted, nowMs, selectedSession, timerSeconds, currentActualDuration, timerRunning]);

  // ── Mark session complete ───────────────────────────────────────────────────

  const toggleComplete = useCallback(async () => {
    if (!selectedSession) return;
    
    const newCompletedStatus = !selectedSession.isCompleted;
    
    // Optimistic update for instant feedback
    setSelectedSession(prev => prev ? { ...prev, isCompleted: newCompletedStatus } : null);
    setSessions(prev =>
      prev.map(s => s._id === selectedSession._id ? { ...s, isCompleted: newCompletedStatus } : s)
    );
    if (newCompletedStatus) {
      setTimerRunning(false);
      setTimerFinished(true);
    }
    
    try {
      const res = await fetch(`/api/sessions/${selectedSession._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: newCompletedStatus }),
      });
      if (!res.ok) {
        // Revert on failure
        setSelectedSession(prev => prev ? { ...prev, isCompleted: !newCompletedStatus } : null);
        setSessions(prev =>
          prev.map(s => s._id === selectedSession._id ? { ...s, isCompleted: !newCompletedStatus } : s)
        );
        if (newCompletedStatus) setTimerFinished(false);
      }
    } catch (e) {
      console.error('Failed to toggle complete', e);
      // Revert on failure
      setSelectedSession(prev => prev ? { ...prev, isCompleted: !newCompletedStatus } : null);
      setSessions(prev =>
        prev.map(s => s._id === selectedSession._id ? { ...s, isCompleted: !newCompletedStatus } : s)
      );
      if (newCompletedStatus) setTimerFinished(false);
    }
  }, [selectedSession]);

  // ── Tasks ───────────────────────────────────────────────────────────────────

  const saveTasks = useCallback(async (newTasks: Task[]) => {
    if (!selectedSession) return;
    if (saveTasksDebounce.current) clearTimeout(saveTasksDebounce.current);
    saveTasksDebounce.current = setTimeout(async () => {
      setSavingTasks(true);
      try {
        await fetch(`/api/sessions/${selectedSession._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: newTasks }),
        });
      } catch {} finally {
        setSavingTasks(false);
      }
    }, 600);
  }, [selectedSession]);

  const addTask = () => {
    if (!newTaskText.trim() || !selectedSession) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      sessionsCompleted: 0,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    setNewTaskText('');
    saveTasks(updated);
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    saveTasks(updated);
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    saveTasks(updated);
  };

  // ── Chat ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Tighter tolerance for being at the bottom to properly detect manual scroll up
    const isAtBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 10;
    userScrolledUp.current = !isAtBottom;
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || !selectedSession?.exam?._id) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    userScrolledUp.current = false;

    const assistantId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    abortControllerRef.current = new AbortController();

    try {
      const allMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          examId: selectedSession.exam._id.toString(),
          sessionId: selectedSession._id.toString(),
          aiIntegration: 'gpt-4o-mini',
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error('Chat failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setChatMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: text } : m)
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        setChatMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: 'Something went wrong. Please try again.' } : m)
        );
      }
    } finally {
      abortControllerRef.current = null;
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setChatLoading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const examColor = getExamColor(selectedSession?.exam);

  // Mobile: track which panel is visible
  const [mobileView, setMobileView] = useState<'list' | 'session'>('list');

  // When a session is selected on mobile, switch to session view
  const handleSelectSessionMobile = useCallback(async (session: StudySession) => {
    await handleSelectSession(session);
    setMobileView('session');
  }, [handleSelectSession]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Hidden Native Date Picker for Direct Jump */}
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        onChange={(e) => {
          if (e.target.value) {
            handleSelectDate(e.target.value);
          }
        }}
        className="hidden"
      />

      {/* Mobile Header (Phones only: < 768px) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
        {mobileView === 'session' && selectedSession ? (
          <button
            onClick={() => {
              setMobileView('list');
              setSelectedSession(null);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('session');
                window.history.replaceState({}, '', url.toString());
              }
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {t('today.backToSessions')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-800 dark:text-white">{t('today.title')}</h1>
            <span suppressHydrationWarning className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {dateHeadingInfo.main}
            </span>
          </div>
        )}
        <span suppressHydrationWarning className="text-xs text-gray-400 dark:text-slate-500">{dateHeadingInfo.date}</span>
      </div>

      {/* Desktop / iPad: 2-column layout / Mobile phone: single panel */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Sessions List + Day Strip + Timer ─────────────────────────── */}
        {/* On mobile: hidden when viewing a session. On iPad / desktop: always visible as fixed column */}
        <div className={`
          md:w-[280px] lg:w-[290px] md:flex-none flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden
          ${mobileView === 'list' ? 'flex flex-1 w-full md:w-[280px] lg:w-[290px] md:flex' : 'hidden md:flex md:w-[280px] lg:w-[290px]'}
        `}>
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 hidden md:flex items-center justify-between gap-1">
            {selectedSession ? (
              <button
                onClick={() => {
                  setSelectedSession(null);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('session');
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 whitespace-nowrap transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                {t('common.back')} ({dateHeadingInfo.main})
              </button>
            ) : (
              <>
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    onClick={handlePrevDay}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={t('today.previousDay')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 suppressHydrationWarning className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {dateHeadingInfo.main}
                      </h2>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {loadingSessions ? t('common.loading') : `${sessions.length} ${sessions.length === 1 ? t('common.session') : t('common.sessions')}`}
                    </p>
                  </div>
                  <button
                    onClick={handleNextDay}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={t('today.nextDay')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!dateHeadingInfo.isToday && (
                    <button
                      onClick={handleJumpToday}
                      className="px-2 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                      title={t('today.jumpToToday')}
                    >
                      {t('common.today')}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (dateInputRef.current) {
                        if ('showPicker' in HTMLInputElement.prototype) {
                          try { (dateInputRef.current as any).showPicker(); } catch { dateInputRef.current.click(); }
                        } else {
                          dateInputRef.current.click();
                        }
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={t('today.pickDate')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </>
            )}
          </div>
          {!selectedSession ? (
            <>
          {/* Horizontal Scrollable Day Strip to Look Ahead */}
          <div className="relative px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div 
              ref={dayStripRef}
              suppressHydrationWarning
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth"
            >
              {dayStripDays.map(day => {
                const isSelected = day.dateStr === selectedDate;
                return (
                  <button
                    key={day.dateStr}
                    data-selected={isSelected}
                    onClick={() => handleSelectDate(day.dateStr)}
                    suppressHydrationWarning
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-11 py-1.5 px-1 rounded-xl transition-all relative ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.03] font-bold'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                    }`}
                    title={`${day.dayName}, ${day.dayNum} ${day.monthShort}${day.hasSessions ? ` (${day.sessionCount} ${day.sessionCount === 1 ? t('common.session') : t('common.sessions')})` : ''}`}
                  >
                    <span suppressHydrationWarning className={`text-[9px] uppercase font-bold tracking-tight leading-none ${
                      isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {day.dayName}
                    </span>
                    <span suppressHydrationWarning className="text-sm font-extrabold leading-tight mt-0.5">
                      {day.dayNum}
                    </span>
                    {/* Indicator Dot(s) */}
                    <div suppressHydrationWarning className="h-2 flex items-center justify-center gap-0.5 mt-0.5">
                      {day.hasSessions ? (
                        day.sessionColors.slice(0, 3).map((col, idx) => (
                          <span
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'ring-1 ring-white/50' : ''}`}
                            style={{ backgroundColor: isSelected ? '#ffffff' : col }}
                          />
                        ))
                      ) : day.isToday ? (
                        <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                      ) : (
                        <span className="w-1 h-1 opacity-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-2 space-y-1.5 min-h-0">
            {!loadingSessions && dayFinishEstimate && (
              <p
                suppressHydrationWarning
                className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1 font-normal"
              >
                {t('today.finishBy')} {dayFinishEstimate.time}
              </p>
            )}
            {loadingSessions ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 px-3 text-gray-400 dark:text-slate-600">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('today.noSessions')} {dateHeadingInfo.main}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('today.freeDay')}</p>
                {nextStudyDate && (
                  <button
                    onClick={handleFindNextStudyDay}
                    className="mt-4 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs"
                  >
                    {t('today.nextStudyDay')} ({formatNextDateShort(nextStudyDate, dateLocale)}) &rarr;
                  </button>
                )}
              </div>
            ) : (
              sessions.map(s => {
                const color = getExamColor(s.exam);
                return (
                  <button
                    key={s._id}
                    onClick={() => handleSelectSessionMobile(s)}
                    className={`w-full text-left rounded-xl p-3 transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 ${s.isCompleted ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold text-gray-500 dark:text-slate-400 truncate ${s.isCompleted ? 'line-through' : ''}`}>
                            {s.exam?.subject || s.subject}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-600 flex-shrink-0">
                            {formatDuration(s.startTime && s.endTime ? Math.min(90, Math.max(30, Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60)))) : Math.min(90, Math.max(30, sessionDuration || 45)))}
                          </span>
                        </div>
                        <p className={`text-sm text-gray-800 dark:text-slate-200 leading-snug mt-0.5 ${s.isCompleted ? 'line-through text-gray-400 dark:text-slate-600' : ''}`}>
                          {(s as any).shortTitle || s.title}
                        </p>
                        {s.isCompleted && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-[#4E774A] dark:text-[#9EC29A]">
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

            </>
          ) : (
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col min-h-0">
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-4 border-b border-gray-100 dark:border-slate-800">
                <div className="w-full flex flex-col items-center gap-4">
                  {/* Session info */}
                  <div className="text-center">
                    <div
                      className="w-3 h-3 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: examColor }}
                    />
                    <h2 className={`text-sm font-bold text-gray-800 dark:text-slate-100 ${selectedSession.isCompleted ? 'line-through opacity-50' : ''}`}>
                      {selectedSession.exam?.subject || selectedSession.subject}
                    </h2>
                  </div>

                  {/* Circular timer */}
                  <div className="relative flex items-center justify-center mt-2 mb-2">
                    <svg width="140" height="140" className="-rotate-90">
                      <circle
                        cx="70" cy="70" r="60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-gray-100 dark:text-slate-800"
                      />
                      <circle
                        cx="70" cy="70" r="60"
                        fill="none"
                        stroke={examColor}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 60}`}
                        strokeDashoffset={`${2 * Math.PI * 60 * (1 - timerProgress / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                      />
                    </svg>
                    <div className="absolute text-center flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums text-gray-800 dark:text-slate-100">
                        {formatTime(timerSeconds)}
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-slate-600">
                        {formatDuration(currentActualDuration)} {t('common.session')}
                      </p>
                    </div>
                  </div>

                  {/* Finish estimate for this session */}
                  {sessionFinishEstimate && (
                    <p
                      suppressHydrationWarning
                      className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 mb-1 font-normal"
                    >
                      {sessionFinishEstimate.isRunning ? t('today.endsAt') : t('today.sessionFinishBy')}: {sessionFinishEstimate.time}
                    </p>
                  )}

                  {/* Timer controls */}
                  <div className="flex items-center justify-center gap-2.5 mt-2">
                    <button
                      onClick={resetTimer}
                      className="p-2 rounded-full border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      title={t('today.reset')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>

                    {!timerRunning ? (
                      <button
                        onClick={startTimer}
                        className="px-6 py-2.5 rounded-full font-semibold text-white text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
                        style={{ backgroundColor: examColor === 'rgb(253, 231, 76)' ? 'rgb(180, 160, 30)' : examColor }}
                      >
                        {timerFinished ? (locale === 'nl' ? 'Opnieuw' : 'Restart') : timerSeconds < currentActualDuration * 60 ? t('today.resume') : t('today.startTimer')}
                      </button>
                    ) : (
                      <button
                        onClick={pauseTimer}
                        className="px-6 py-2.5 rounded-full font-semibold text-white text-sm bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        {t('today.pause')}
                      </button>
                    )}

                    {/* Round Accent Green Toggle Button */}
                    <button
                      onClick={toggleComplete}
                      title={selectedSession.isCompleted ? t('today.markAsUndone') : t('today.markAsDone')}
                      className={`p-2 rounded-full border transition-all flex items-center justify-center w-10 h-10 ${
                        selectedSession.isCompleted
                          ? 'border-[#9EC29A] bg-[#9EC29A] text-slate-950 dark:text-slate-950 hover:bg-[#8eb58a] hover:border-[#8eb58a] shadow-sm'
                          : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:bg-[#9EC29A]/15 dark:hover:bg-[#9EC29A]/15 hover:border-[#9EC29A]/40 hover:text-[#4E774A] dark:hover:text-[#9EC29A]'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={selectedSession.isCompleted ? 3 : 2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-center mt-2 min-h-6">
                    {selectedSession.isCompleted ? (
                      <p className="text-xs text-[#4E774A] dark:text-[#9EC29A] font-semibold">
                        {t('today.sessionComplete')}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Tasks section */}
              <div className="flex-shrink-0">
                <div className="border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  {t('today.tasks')}
                </h2>
                {savingTasks && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 animate-pulse">{t('today.savingTasks')}</span>
                )}
              </div>
              <div className="px-3 py-2 max-h-56 overflow-y-auto no-scrollbar space-y-1.5">
                {tasks.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-600 text-center py-3">{t('today.noTasksYet')}</p>
                )}
                {tasks.map(t => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      t.completed
                        ? 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => toggleTask(t.id)}
                      className="w-3.5 h-3.5 accent-slate-600 flex-shrink-0 cursor-pointer"
                    />
                    <span className={`flex-1 text-xs leading-snug ${t.completed ? 'line-through text-gray-400 dark:text-slate-600' : 'text-gray-700 dark:text-slate-300'}`}>
                      {t.text}
                    </span>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3 pt-1 flex gap-1.5">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder={t('today.addTask')}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={addTask}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {t('today.addButton')}
                </button>
              </div>
            </div>
            </div>
            </div>
          )}
        </div>

        {/* ── CENTER: AI Chat ─────────────────────────────────────────────────── */}
        {/* On mobile: shown when a session is selected (alongside the timer/tasks), stacked */}
        <div className={`
          flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden
          ${mobileView === 'session' ? 'flex' : 'hidden md:flex'}
        `}>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 min-h-0"
          >
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-dark/40 dark:text-slate-500 p-6 text-center select-none">
                <svg className="w-16 h-16 mb-4 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium text-base text-neutral-dark dark:text-slate-300">{t('today.selectSessionToChat')}</p>
                <p className="text-xs text-neutral-dark/70 dark:text-slate-400 mt-1">{t('today.selectSessionHint')}</p>
              </div>
            ) : fetchingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto opacity-70 p-6 select-none">
                <div
                  className="w-10 h-10 rounded-full mb-3 shadow-sm flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: examColor || 'var(--sidebar-bg)' }}
                >
                  {(selectedSession.exam?.subject || selectedSession.subject)?.charAt(0)?.toUpperCase() || '✨'}
                </div>
                <p className="text-base font-semibold text-neutral-dark dark:text-slate-200">
                  {t('today.askAbout')} {selectedSession.exam?.subject || selectedSession.subject}
                </p>
                <p className="text-xs text-neutral-dark/70 dark:text-slate-400 mt-1">
                  {t('today.studyBuddyHint')}
                </p>
              </div>
            ) : (
              chatMessages.map(m => (
                <div key={m.id} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Main Message Bubble */}
                  <div
                    className={`group relative max-w-[90%] sm:max-w-[80%] px-4 py-2.5 shadow-sm ${
                      m.role === 'user'
                        ? 'bg-indigo-600 dark:bg-indigo-600 text-white dark:text-slate-900 rounded-2xl rounded-br-sm border border-transparent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm border border-slate-200 dark:border-slate-700/50'
                    }`}
                  >
                    {m.content === '' && m.role === 'assistant' ? (
                      <div className="flex gap-1 py-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                    ) : (
                      <div className={`text-[15px] sm:text-sm leading-relaxed prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 ${
                        m.role === 'user'
                          ? 'text-white dark:text-slate-900 prose-p:text-white dark:prose-p:text-slate-900 prose-headings:text-white dark:prose-headings:text-slate-900 prose-strong:text-white dark:prose-strong:text-slate-900 prose-code:text-white dark:prose-code:text-slate-900'
                          : 'dark:prose-invert text-slate-800 dark:text-slate-100'
                      }`}>
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{preprocessMath(m.content)}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-3 sm:px-4 pb-4 pt-2 border-t sm:border-t-0 border-neutral-dark/5 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto flex-shrink-0">
            <div className={`flex items-end gap-2 max-w-4xl mx-auto bg-neutral-light/30 dark:bg-slate-800/80 border sm:border-2 border-neutral-dark/10 dark:border-slate-700 rounded-3xl p-1.5 sm:p-2 shadow-sm transition-colors ${!selectedSession ? 'opacity-50' : 'focus-within:border-neutral-dark/30 dark:focus-within:border-slate-500'}`}>
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={e => {
                  setChatInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatLoading) {
                      sendChatMessage();
                      if (chatInputRef.current) {
                        chatInputRef.current.style.height = 'auto';
                      }
                    }
                  }
                }}
                rows={1}
                placeholder={selectedSession ? `${t('today.askPlaceholder')} ${selectedSession.exam?.subject || selectedSession.subject}…` : t('today.selectSessionFirst')}
                disabled={!selectedSession}
                className="flex-1 bg-transparent py-2 pl-3 sm:pl-4 pr-1 text-base sm:text-sm text-neutral-dark dark:text-slate-100 focus:outline-none resize-none overflow-y-auto disabled:cursor-not-allowed"
                style={{ minHeight: '40px', maxHeight: '200px' }}
              />
              <div className="shrink-0 flex items-center justify-center">
                {chatLoading ? (
                  <button
                    onClick={stopGeneration}
                    className="w-10 h-10 bg-slate-600 dark:bg-slate-500 text-white rounded-full hover:bg-slate-700 transition-all shadow-sm flex items-center justify-center active:scale-95"
                    title={t('today.stopGenerating')}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      sendChatMessage();
                      if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
                    }}
                    disabled={!selectedSession || !chatInput.trim()}
                    className="w-10 h-10 bg-slate-900 dark:bg-[#27272a] text-white rounded-full hover:bg-opacity-90 disabled:opacity-40 transition-all shadow-sm flex items-center justify-center active:scale-95"
                  >
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>



      </div>
    </div>
  );
}

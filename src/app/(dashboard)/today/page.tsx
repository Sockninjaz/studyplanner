'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudyHubPage() {
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

  // ── Fetch today's sessions ──────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sessions?date=today');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

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
    <div className="h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
        {mobileView === 'session' && selectedSession ? (
          <button
            onClick={() => {
              setMobileView('list');
              setSelectedSession(null);
              if (typeof window !== 'undefined') window.history.replaceState({}, '', '/today');
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
        ) : (
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Study Hub</h1>
        )}
        <span className="text-xs text-gray-400 dark:text-slate-500">{today}</span>
      </div>

      {/* Desktop: 3-column layout / Mobile: single panel */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Today's Sessions + Tasks + Timer ─────────────────────────── */}
        {/* On mobile: hidden when viewing a session. On desktop: always visible as fixed column */}
        <div className={`
          lg:w-[240px] lg:flex-shrink-0 lg:flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden
          ${mobileView === 'list' ? 'flex flex-1 w-full' : 'hidden'}
        `}>
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0 hidden lg:flex">
            {selectedSession ? (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.location.search.includes('session=')) {
                     window.history.back();
                  } else {
                     setSelectedSession(null);
                     if (typeof window !== 'undefined') {
                       window.history.replaceState({}, '', '/today');
                     }
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
            ) : (
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                Today's Sessions
              </h2>
            )}
          </div>
          {!selectedSession ? (
            <>
          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
            {loadingSessions ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-slate-600">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No sessions today</p>
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
                          <span className="inline-block mt-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                            ✓ Done
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
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-6 border-b border-gray-100 dark:border-slate-800">
                <div className="w-full flex flex-col items-center gap-6">
                  {/* Session info */}
                  <div className="text-center">
                    <div
                      className="w-3 h-3 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: examColor }}
                    />
                    <h2 className={`text-sm font-bold text-gray-800 dark:text-slate-100 ${selectedSession.isCompleted ? 'line-through opacity-50' : ''}`}>
                      {selectedSession.exam?.subject || selectedSession.subject}
                    </h2>
                    <p className={`text-xs mt-0.5 leading-snug line-clamp-3 ${selectedSession.isCompleted ? 'line-through text-gray-400 dark:text-slate-600' : 'text-gray-500 dark:text-slate-400'}`}>
                      {selectedSession.title}
                    </p>
                    {selectedSession.exam?.date && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1">
                        Exam in {getDaysUntil(selectedSession.exam.date)} days
                      </p>
                    )}
                  </div>

                  {/* Circular timer */}
                  <div className="relative flex items-center justify-center mt-2 mb-2">
                    <svg width="100" height="100" className="-rotate-90">
                      <circle
                        cx="50" cy="50" r="44"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-gray-100 dark:text-slate-800"
                      />
                      <circle
                        cx="50" cy="50" r="44"
                        fill="none"
                        stroke={examColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 44}`}
                        strokeDashoffset={`${2 * Math.PI * 44 * (1 - timerProgress / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                      />
                    </svg>
                    <div className="absolute text-center flex flex-col items-center justify-center">
                      <span className="text-xl font-bold tabular-nums text-gray-800 dark:text-slate-100">
                        {formatTime(timerSeconds)}
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-slate-600">
                        {formatDuration(currentActualDuration)} session
                      </p>
                    </div>
                  </div>

                  {/* Timer controls */}
                  <div className="flex items-center justify-center gap-2.5 mt-2">
                    <button
                      onClick={resetTimer}
                      className="p-2 rounded-full border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                      title="Reset"
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
                        {timerFinished ? 'Restart' : timerSeconds < currentActualDuration * 60 ? 'Resume' : 'Start'}
                      </button>
                    ) : (
                      <button
                        onClick={pauseTimer}
                        className="px-6 py-2.5 rounded-full font-semibold text-white text-sm bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        Pause
                      </button>
                    )}

                    {/* Round Green Toggle Button */}
                    <button
                      onClick={toggleComplete}
                      title={selectedSession.isCompleted ? 'Mark as undone' : 'Mark as done'}
                      className={`p-2 rounded-full border transition-all flex items-center justify-center w-10 h-10 ${
                        selectedSession.isCompleted
                          ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600 shadow-sm'
                          : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 hover:text-green-500'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={selectedSession.isCompleted ? 3 : 2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="text-center mt-4 h-8">
                    {selectedSession.isCompleted ? (
                      <p className="text-sm text-green-600 dark:text-green-400 font-bold animate-pulse">
                        ✅ Session Complete!
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
                  Tasks
                </h2>
                {savingTasks && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 animate-pulse">saving…</span>
                )}
              </div>
              <div className="px-3 py-2 max-h-56 overflow-y-auto space-y-1.5">
                {tasks.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-600 text-center py-3">No tasks yet</p>
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
                  placeholder="Add a task…"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button
                  onClick={addTask}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 transition-colors"
                >
                  Add
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
          flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden
          ${mobileView === 'session' ? 'flex' : 'hidden lg:flex'}
        `}>


          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0"
          >
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-slate-700 text-center select-none">
                <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-base">Select a session to chat with your AI tutor</p>
              </div>
            ) : fetchingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div
                  className="w-12 h-12 rounded-full mb-4 flex items-center justify-center"
                  style={{ backgroundColor: examColor + '33' }}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: examColor }} />
                </div>
                <p className="text-base font-medium text-gray-600 dark:text-slate-300">
                  Ready to help with {selectedSession.exam?.subject || selectedSession.subject}
                </p>
                <p className="text-sm text-gray-400 dark:text-slate-600 mt-2 max-w-md">
                  Ask me anything about this session: "{selectedSession.title}"
                </p>
              </div>
            ) : (
              chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-slate-900 dark:bg-[#27272a] text-white rounded-br-sm border border-transparent dark:border-zinc-700/50 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm border border-gray-100 dark:border-slate-700 shadow-sm'
                    }`}
                  >
                    {m.content === '' && m.role === 'assistant' ? (
                      <div className="flex gap-1 py-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-5 pb-5 pt-2 flex-shrink-0">
            <div className="relative flex items-center">
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
                      // Reset height after sending
                      if (chatInputRef.current) {
                        chatInputRef.current.style.height = 'auto';
                      }
                    }
                  }
                }}
                rows={1}
                placeholder={selectedSession ? `Ask about ${selectedSession.exam?.subject || selectedSession.subject}…` : 'Select a session first'}
                disabled={!selectedSession}
                className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-[20px] py-2.5 pl-4 pr-12 text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-y-auto transition-all shadow-sm"
                style={{ minHeight: '44px', maxHeight: '200px' }}
              />
              {chatLoading ? (
                <button
                  onClick={stopGeneration}
                  className="absolute right-1.5 bottom-1.5 p-1.5 bg-slate-500 text-white rounded-full hover:bg-slate-600 transition-colors flex-shrink-0 shadow-md"
                  title="Stop generating"
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
                  className="absolute right-1.5 bottom-1.5 p-1.5 bg-slate-700 text-white rounded-full hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>



      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { readAIStream } from '@/lib/ai-stream';

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
  const chatInputRef = useRef<HTMLInputElement>(null);
  const userScrolledUp = useRef(false);

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
  }, [fetchSessions]);

  // ── Select a session ────────────────────────────────────────────────────────

  const handleSelectSession = useCallback(async (session: StudySession) => {
    setSelectedSession(session);
    setTimerSeconds(sessionDuration * 60);
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

  const startTimer = () => {
    if (timerFinished) {
      setTimerSeconds(sessionDuration * 60);
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
    setTimerSeconds(sessionDuration * 60);
  };

  const timerProgress = selectedSession
    ? ((sessionDuration * 60 - timerSeconds) / (sessionDuration * 60)) * 100
    : 0;

  // ── Mark session complete ───────────────────────────────────────────────────

  const markComplete = useCallback(async () => {
    if (!selectedSession) return;
    try {
      const res = await fetch(`/api/sessions/${selectedSession._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (res.ok) {
        setSelectedSession(prev => prev ? { ...prev, isCompleted: true } : null);
        setSessions(prev =>
          prev.map(s => s._id === selectedSession._id ? { ...s, isCompleted: true } : s)
        );
      }
    } catch (e) {
      console.error('Failed to mark complete', e);
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
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
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

    try {
      const allMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          examId: selectedSession.exam._id.toString(),
          aiIntegration: 'gpt-4o-mini',
        }),
      });

      if (!res.ok || !res.body) throw new Error('Chat failed');

      let text = '';
      await readAIStream(res.body, (chunk) => {
        text += chunk;
        setChatMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: text } : m)
        );
      });
    } catch {
      setChatMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: 'Something went wrong. Please try again.' } : m)
      );
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const examColor = getExamColor(selectedSession?.exam);

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Study Hub</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">{today}</p>
        </div>
        {selectedSession && (
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: examColor }}
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              {selectedSession.exam?.subject || selectedSession.subject}
            </span>
            <span className="text-xs text-gray-400 dark:text-slate-500">·</span>
            <span className="text-xs text-gray-500 dark:text-slate-400 max-w-xs truncate">
              {selectedSession.title}
            </span>
          </div>
        )}
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Today's Sessions + Tasks ─────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
              Today's Sessions
            </h2>
          </div>

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
                const isSelected = selectedSession?._id === s._id;
                return (
                  <button
                    key={s._id}
                    onClick={() => handleSelectSession(s)}
                    className={`w-full text-left rounded-xl p-3 transition-all border ${
                      isSelected
                        ? 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 shadow-sm'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    } ${s.isCompleted ? 'opacity-50' : ''}`}
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
                            {formatDuration(sessionDuration)}
                          </span>
                        </div>
                        <p className={`text-sm text-gray-800 dark:text-slate-200 leading-snug mt-0.5 ${s.isCompleted ? 'line-through text-gray-400 dark:text-slate-600' : ''}`}>
                          {s.title}
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

          {/* Tasks section */}
          {selectedSession && (
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
          )}
        </div>

        {/* ── CENTER: AI Chat ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
              AI Tutor
            </h2>
            {selectedSession?.exam && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                {selectedSession.exam.subject} · "{selectedSession.title}"
              </p>
            )}
          </div>

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
                  Ask me anything about today's topic: "{selectedSession.title}"
                </p>
              </div>
            ) : (
              chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm border border-gray-100 dark:border-slate-700 shadow-sm'
                    }`}
                    style={m.role === 'user' ? { backgroundColor: 'rgb(54, 65, 86)' } : {}}
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
          <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder={selectedSession ? `Ask about ${selectedSession.exam?.subject || selectedSession.subject}…` : 'Select a session first'}
                disabled={!selectedSession || chatLoading}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendChatMessage}
                disabled={!selectedSession || !chatInput.trim() || chatLoading}
                className="px-4 py-2.5 rounded-xl bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 text-sm font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Timer ────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col items-center justify-center border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto px-6 py-8">
          {!selectedSession ? (
            <div className="text-center opacity-40 select-none">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-500">Select a session</p>
              <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">to start the timer</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              {/* Session info */}
              <div className="text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: examColor }}
                />
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">
                  {selectedSession.exam?.subject || selectedSession.subject}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                  {selectedSession.title}
                </p>
                {selectedSession.exam?.date && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1">
                    Exam in {getDaysUntil(selectedSession.exam.date)} days
                  </p>
                )}
              </div>

              {/* Circular timer */}
              <div className="relative flex items-center justify-center">
                <svg width="180" height="180" className="-rotate-90">
                  <circle
                    cx="90" cy="90" r="78"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-gray-100 dark:text-slate-800"
                  />
                  <circle
                    cx="90" cy="90" r="78"
                    fill="none"
                    stroke={timerFinished ? '#22c55e' : examColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 78}`}
                    strokeDashoffset={`${2 * Math.PI * 78 * (1 - timerProgress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className={`text-3xl font-bold tabular-nums ${timerFinished ? 'text-green-500' : 'text-gray-800 dark:text-slate-100'}`}>
                    {formatTime(timerSeconds)}
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1">
                    {formatDuration(sessionDuration)} session
                  </p>
                </div>
              </div>

              {/* Timer controls */}
              <div className="flex items-center gap-2.5">
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
                    {timerFinished ? 'Restart' : timerSeconds < sessionDuration * 60 ? 'Resume' : 'Start'}
                  </button>
                ) : (
                  <button
                    onClick={pauseTimer}
                    className="px-6 py-2.5 rounded-full font-semibold text-white text-sm bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg transition-all active:scale-95"
                  >
                    Pause
                  </button>
                )}

                {/* Mark done button */}
                <button
                  onClick={markComplete}
                  disabled={selectedSession.isCompleted}
                  title={selectedSession.isCompleted ? 'Already completed' : 'Mark as done'}
                  className={`p-2 rounded-full border transition-colors ${
                    selectedSession.isCompleted
                      ? 'border-green-300 dark:border-green-800 text-green-500 dark:text-green-400 cursor-default'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 hover:text-green-500'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>

              {timerFinished && !selectedSession.isCompleted && (
                <div className="text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">⏱ Time's up! Great work.</p>
                  <button
                    onClick={markComplete}
                    className="px-4 py-2 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                  >
                    Mark as Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

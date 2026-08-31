'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mutate } from 'swr';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  sessionsCompleted: number;
}

interface TimerContextType {
  activeSessionId: string | null;
  activeSessionData: any | null;
  mode: 'idle' | 'session' | 'break';
  timeLeft: number;
  isPaused: boolean;
  sessionCount: number;
  tasks: Task[];
  currentTaskId: string | null;
  duration: number; // default duration of the session
  
  // Actions
  initializeSession: (sessionId: string, sessionData: any, duration: number) => void;
  startTimer: (selectedMode?: 'session' | 'break') => void;
  pauseTimer: () => void;
  continueTimer: () => void;
  resetTimer: () => void;
  switchToBreak: () => void;
  switchToSession: () => void;
  addTask: (text: string) => void;
  toggleTaskComplete: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  selectTask: (taskId: string) => void;
  saveTasksToSession: () => Promise<void>;
  getSessionState: (id: string) => any;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null);
  const [duration, setDuration] = useState(60);
  
  const [mode, setMode] = useState<'idle' | 'session' | 'break'>('idle');
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [savedSessionTime, setSavedSessionTime] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [savedSessions, setSavedSessions] = useState<Record<string, any>>({});

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('studyTimerState');
      if (saved) {
        const state = JSON.parse(saved);
        setSavedSessions(state.savedSessions || {});
        
        if (state.activeSessionId) {
          setActiveSessionId(state.activeSessionId);
          setActiveSessionData(state.activeSessionData);
          setMode(state.mode || 'idle');
          setDuration(state.duration || 60);
          setIsPaused(state.isPaused !== undefined ? state.isPaused : true); // default to paused if restoring
          setSessionCount(state.sessionCount || 0);
          setTasks(state.tasks || []);
          setCurrentTaskId(state.currentTaskId || null);
          setSavedSessionTime(state.savedSessionTime || null);

          // Calculate new timeLeft based on endTime
          if (state.endTime && !state.isPaused && state.mode !== 'idle') {
            const remaining = Math.ceil((state.endTime - Date.now()) / 1000);
            if (remaining > 0) {
              setTimeLeft(remaining);
              setEndTime(state.endTime);
            } else {
              // Timer expired while away
              setTimeLeft(0);
              setEndTime(null);
            }
          } else {
            setTimeLeft(state.timeLeft || duration * 60);
            setEndTime(null); // Clear endTime if paused so it recalculates on resume
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore timer state', e);
    }
    setIsInitialized(true);
  }, []);

  // Save state to localStorage whenever important fields change
  useEffect(() => {
    if (!isInitialized) return;
    
    const state = {
      activeSessionId,
      activeSessionData,
      mode,
      timeLeft,
      isPaused,
      sessionCount,
      tasks,
      currentTaskId,
      endTime,
      duration,
      savedSessionTime,
      savedSessions
    };
    localStorage.setItem('studyTimerState', JSON.stringify(state));
  }, [isInitialized, activeSessionId, activeSessionData, mode, timeLeft, isPaused, sessionCount, tasks, currentTaskId, endTime, duration, savedSessionTime, savedSessions]);

  // Core ticker logic
  useEffect(() => {
    if (mode === 'idle' || isPaused || !activeSessionId) return;

    if (timeLeft <= 0) {
      if (mode === 'session') {
        if (currentTaskId) {
          setTasks(prev => prev.map(task =>
            task.id === currentTaskId
              ? { ...task, sessionsCompleted: task.sessionsCompleted + 1 }
              : task
          ));
        }
        setSessionCount(prev => prev + 1);
        setMode('break');
        setTimeLeft(5 * 60);
        setEndTime(null);
        setIsPaused(true);
      } else {
        const totalPomodoros = Math.ceil(duration / 25);
        if (sessionCount >= totalPomodoros) {
          setMode('idle');
          setEndTime(null);
          // Optional: handle full session completion automatically
        } else {
          setMode('session');
          setTimeLeft(duration * 60);
          setEndTime(null);
          setIsPaused(true);
        }
      }
      return;
    }

    if (endTime === null) {
      setEndTime(Date.now() + timeLeft * 1000);
    }

    const intervalId = setInterval(() => {
      if (endTime !== null) {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        setTimeLeft(Math.max(0, remaining));
      }
    }, 250);

    return () => clearInterval(intervalId);
  }, [mode, timeLeft, duration, isPaused, sessionCount, currentTaskId, endTime, activeSessionId]);

  // Save tasks logic (auto-save when tasks change and activeSessionId exists)
  useEffect(() => {
    if (activeSessionId) {
      const saveTasks = async () => {
        try {
          const res = await fetch(`/api/sessions/${activeSessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks }),
          });
          if (res.status === 404) {
            setActiveSessionId(null);
            return;
          }
          mutate(`/api/sessions/${activeSessionId}`);
        } catch (error) {
          console.error('Failed to save tasks:', error);
        }
      };
      saveTasks();
    }
  }, [tasks, activeSessionId]);

  const saveTasksToSession = async () => {
    if (!activeSessionId) return;
    try {
      await fetch(`/api/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      mutate(`/api/sessions/${activeSessionId}`);
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  const getSessionState = (id: string) => {
    if (id === activeSessionId) {
      return { mode, timeLeft, isPaused, sessionCount, duration };
    }
    return savedSessions[id] || null;
  };

  const initializeSession = (sessionId: string, sessionData: any, sessDuration: number) => {
    if (activeSessionId === sessionId) {
      // If we re-enter the same session, update data but don't reset timer
      setActiveSessionData(sessionData);
      setDuration(sessDuration);
      if (sessionData.tasks && Array.isArray(sessionData.tasks) && tasks.length === 0) {
        setTasks(sessionData.tasks);
      }
      return;
    }

    // Save the old session state before switching
    if (activeSessionId) {
      setSavedSessions(prev => ({
        ...prev,
        [activeSessionId]: {
          activeSessionData,
          mode,
          timeLeft,
          isPaused: true, // Auto-pause when backgrounded
          sessionCount,
          tasks,
          currentTaskId,
          endTime: null, // Cleared because it's paused
          duration,
          savedSessionTime
        }
      }));
    }

    // Restore the new session state if it exists
    const restored = savedSessions[sessionId];
    if (restored) {
      setActiveSessionId(sessionId);
      setActiveSessionData(restored.activeSessionData || sessionData);
      setMode(restored.mode);
      
      // Sanity check: if we have a stale buggy duration in local storage (e.g. 60)
      // but the database says otherwise, and the timer hasn't started yet, override it.
      if (restored.duration && restored.duration !== sessDuration && restored.mode === 'idle') {
        setTimeLeft(sessDuration * 60);
        setDuration(sessDuration);
      } else {
        setTimeLeft(restored.timeLeft);
        setDuration(restored.duration || sessDuration);
      }
      
      setIsPaused(true); // Always paused when restored, user must click Play
      setSessionCount(restored.sessionCount);
      setTasks(restored.tasks || []);
      setCurrentTaskId(restored.currentTaskId);
      setEndTime(null);
      setSavedSessionTime(restored.savedSessionTime);
      return;
    }

    // New session initialized from scratch
    setActiveSessionId(sessionId);
    setActiveSessionData(sessionData);
    setDuration(sessDuration);
    setMode('idle');
    setTimeLeft(sessDuration * 60);
    setIsPaused(true); // Default to paused, wait for user to click play
    setSessionCount(0);
    setEndTime(null);
    setSavedSessionTime(null);
    setCurrentTaskId(null);
    
    if (sessionData.tasks && Array.isArray(sessionData.tasks)) {
      setTasks(sessionData.tasks);
    } else {
      setTasks([]);
    }
  };

  const startTimer = (selectedMode: 'session' | 'break' = 'session') => {
    setMode(selectedMode);
    const seconds = selectedMode === 'session' ? duration * 60 : 5 * 60;
    setTimeLeft(seconds);
    setEndTime(Date.now() + seconds * 1000);
    setIsPaused(false);
    if (selectedMode === 'session') {
      setSessionCount(0);
    }
  };

  const pauseTimer = () => {
    setIsPaused(true);
    setEndTime(null);
  };

  const continueTimer = () => {
    setEndTime(Date.now() + timeLeft * 1000);
    setIsPaused(false);
  };

  const resetTimer = () => {
    setMode('idle');
    setTimeLeft(duration * 60);
    setEndTime(null);
    setIsPaused(true);
    setSessionCount(0);
  };

  const switchToBreak = () => {
    if (mode === 'session') {
      setSavedSessionTime(timeLeft);
    }
    setMode('break');
    setTimeLeft(5 * 60);
    setEndTime(null);
    setIsPaused(true);
  };

  const switchToSession = () => {
    setMode('session');
    setTimeLeft(savedSessionTime !== null ? savedSessionTime : duration * 60);
    setSavedSessionTime(null);
    setEndTime(null);
    setIsPaused(true);
  };

  const addTask = (text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      completed: false,
      sessionsCompleted: 0
    };
    setTasks([...tasks, newTask]);
  };

  const toggleTaskComplete = (taskId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (currentTaskId === taskId) setCurrentTaskId(null);
  };

  const selectTask = (taskId: string) => {
    setCurrentTaskId(taskId);
  };

  return (
    <TimerContext.Provider value={{
      activeSessionId,
      activeSessionData,
      mode,
      timeLeft,
      isPaused,
      sessionCount,
      tasks,
      currentTaskId,
      duration,
      initializeSession,
      startTimer,
      pauseTimer,
      continueTimer,
      resetTimer,
      switchToBreak,
      switchToSession,
      addTask,
      toggleTaskComplete,
      deleteTask,
      selectTask,
      saveTasksToSession,
      getSessionState,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}

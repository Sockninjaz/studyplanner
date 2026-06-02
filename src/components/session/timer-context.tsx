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
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null);
  const [duration, setDuration] = useState(60);
  
  const [mode, setMode] = useState<'idle' | 'session' | 'break'>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [savedSessionTime, setSavedSessionTime] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('studyTimerState');
      if (saved) {
        const state = JSON.parse(saved);
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
            setTimeLeft(state.timeLeft || 25 * 60);
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
      savedSessionTime
    };
    localStorage.setItem('studyTimerState', JSON.stringify(state));
  }, [isInitialized, activeSessionId, activeSessionData, mode, timeLeft, isPaused, sessionCount, tasks, currentTaskId, endTime, duration, savedSessionTime]);

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
          setTimeLeft(25 * 60);
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
      // Debounce saving or just save immediately, here we do it immediately but might be noisy.
      // Doing it immediately to preserve old behavior.
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

    // New session initialized, pause old one implicitly by overwriting
    setActiveSessionId(sessionId);
    setActiveSessionData(sessionData);
    setDuration(sessDuration);
    setMode('idle');
    setTimeLeft(25 * 60);
    setIsPaused(false);
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
    const seconds = selectedMode === 'session' ? 25 * 60 : 5 * 60;
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
    setTimeLeft(25 * 60);
    setEndTime(null);
    setIsPaused(false);
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
    setTimeLeft(savedSessionTime !== null ? savedSessionTime : 25 * 60);
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

'use client';

import { useState } from 'react';
import { useTimer } from './timer-context';

interface Props {
  duration: number; // in minutes
  onComplete: () => void;
  sessionId?: string;
  session?: any;
}

export default function Timer({ duration, onComplete, sessionId, session }: Props) {
  const {
    activeSessionId,
    mode: globalMode,
    timeLeft: globalTimeLeft,
    sessionCount: globalSessionCount,
    duration: globalDuration,
    startTimer,
    pauseTimer,
    continueTimer,
    resetTimer,
    switchToBreak,
    switchToSession,
    isPaused: globalIsPaused,
    tasks,
    addTask,
    toggleTaskComplete,
    deleteTask,
    selectTask,
    currentTaskId,
    initializeSession,
    getSessionState
  } = useTimer();

  const [newTaskText, setNewTaskText] = useState('');

  // Determine which state to show: the active global state, or the saved paused state for this specific session
  const isActive = !sessionId || sessionId === activeSessionId;
  const savedState = !isActive && sessionId ? getSessionState(sessionId) : null;

  const mode = isActive ? globalMode : (savedState?.mode || 'idle');
  const currentDuration = isActive ? globalDuration : duration;
  const timeLeft = isActive ? globalTimeLeft : (savedState?.timeLeft || currentDuration * 60);
  const isPaused = isActive ? globalIsPaused : true; // Inactive sessions are always paused visually
  const sessionCount = isActive ? globalSessionCount : (savedState?.sessionCount || 0);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    const totalTime = mode === 'session' ? currentDuration * 60 : 5 * 60;
    const elapsed = totalTime - timeLeft;
    return Math.max(0, Math.min(100, (elapsed / totalTime) * 100));
  };

  const handleAddTask = () => {
    if (newTaskText.trim()) {
      addTask(newTaskText.trim());
      setNewTaskText('');
    }
  };

  const handleAction = (action: () => void) => {
    if (!isActive && sessionId) {
      // If there's another session active, warn the user
      if (activeSessionId) {
        if (!window.confirm("Je hebt nog een andere sessie lopen! Wil je deze pauzeren en overschakelen naar deze sessie?")) {
          return;
        }
      }
      initializeSession(sessionId, session, duration);
      // Wait for state to update, then perform action
      setTimeout(action, 0);
    } else {
      action();
    }
  };

  const handleStartTimer = () => {
    handleAction(() => {
      if (mode === 'idle') startTimer('session');
      else continueTimer();
    });
  };

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="text-center">
        <div className={`my-4 text-5xl md:text-6xl font-bold font-mono tracking-tight ${mode === 'break' ? 'text-green-500' :
          mode === 'session' ? 'text-blue-500' :
            'text-slate-400 dark:text-slate-500'
          }`}>
          {formatTime(timeLeft)}
        </div>

        {/* Progress Bar */}
        {(mode === 'session' || mode === 'break') && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-5 max-w-md mx-auto overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${mode === 'break' ? 'bg-green-500' : 'bg-blue-500'
                }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        )}

        <div className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {mode === 'idle' ? 'Ready to start?' :
            mode === 'session' ? `Study Session ${sessionCount + 1}/${Math.ceil(duration / 25)}` :
              `Break ${sessionCount}/${Math.ceil(duration / 25)}`}
        </div>

        {/* Mode Selection */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => mode === 'idle' ? null : handleAction(switchToSession)}
            className={`px-4 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-wide ${mode === 'idle'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
              : mode === 'session'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            disabled={mode === 'idle'}
          >
            Session
          </button>
          <button
            onClick={() => mode === 'idle' ? null : handleAction(switchToBreak)}
            className={`px-4 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-wide ${mode === 'idle'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
              : mode === 'break'
                ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            disabled={mode === 'idle'}
          >
            Break
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center items-center">
          <button
            onClick={() => handleAction(resetTimer)}
            className="rounded-xl bg-slate-200 dark:bg-slate-800 p-3 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            title="Reset Timer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {mode === 'idle' && (
            <button
              onClick={handleStartTimer}
              className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Start Session
            </button>
          )}

          {mode !== 'idle' && isPaused && (
            <button
              onClick={handleStartTimer}
              className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Resume
            </button>
          )}

          {mode !== 'idle' && !isPaused && (
            <button
              onClick={() => handleAction(pauseTimer)}
              className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/30 flex items-center gap-2 text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Pause
            </button>
          )}
        </div>
      </div>

      {/* Task Management */}
      <div className="border-t pt-5 mt-6 border-slate-100 dark:border-slate-800">
        <h3 className="text-base font-semibold mb-3">Tasks</h3>

        {/* Add Task */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddTask}
            className="px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-3">No tasks yet. Add one above!</p>
          ) : (
            tasks.map(task => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${currentTaskId === task.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTaskComplete(task.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span
                  className={`flex-1 cursor-pointer text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  onClick={() => selectTask(task.id)}
                >
                  {task.text}
                </span>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  {task.sessionsCompleted} sessions
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

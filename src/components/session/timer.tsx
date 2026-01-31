'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  sessionsCompleted: number;
}

interface Props {
  duration: number; // in minutes
  onComplete: () => void;
  sessionId?: string;
  session?: any;
}

export default function Timer({ duration, onComplete, sessionId, session }: Props) {
  const [mode, setMode] = useState<'idle' | 'session' | 'break'>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // Default to 25 minutes
  const [isPaused, setIsPaused] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Load tasks and notes from session on mount
  useEffect(() => {
    if (sessionId && session) {
      console.log('Loading session data:', session);
      // Load tasks from session data if available
      if (session.tasks && Array.isArray(session.tasks)) {
        console.log('Setting tasks from session:', session.tasks);
        setTasks(session.tasks);
      } else {
        console.log('No tasks found in session, initializing empty array');
        // Initialize empty tasks array if none exists
        setTasks([]);
      }
    }
  }, [sessionId, session]);

  // Save tasks whenever they change (including empty array to initialize field)
  useEffect(() => {
    if (sessionId) {
      console.log('Saving tasks:', tasks);
      saveTasksToSession();
    }
  }, [tasks, sessionId]);

  const saveTasksToSession = async () => {
    try {
      console.log('Saving tasks to session:', sessionId, tasks);
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save tasks');
      }
      
      const result = await response.json();
      console.log('Save response:', result);
      mutate(`/api/sessions/${sessionId}`);
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  useEffect(() => {
    if (mode === 'idle' || isPaused) return;

    if (timeLeft <= 0) {
      if (mode === 'session') {
        // Session completed - update task sessions and start break
        if (currentTaskId) {
          const updatedTasks = tasks.map(task => 
            task.id === currentTaskId 
              ? { ...task, sessionsCompleted: task.sessionsCompleted + 1 }
              : task
          );
          setTasks(updatedTasks);
        }
        setSessionCount(prev => prev + 1);
        setMode('break');
        setTimeLeft(5 * 60); // 5-minute break
      } else {
        // Break completed, check if we should continue
        if (sessionCount + 1 >= Math.ceil(duration / 25)) {
          // All sessions completed
          setMode('idle');
          onComplete();
        } else {
          // Start next session
          setMode('session');
          setTimeLeft(25 * 60);
        }
      }
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [mode, timeLeft, duration, onComplete, isPaused, sessionCount, currentTaskId]);

  const startTimer = (selectedMode: 'session' | 'break' = 'session') => {
    setMode(selectedMode);
    setTimeLeft(selectedMode === 'session' ? 25 * 60 : 5 * 60);
    setIsPaused(false);
    if (selectedMode === 'session') {
      setSessionCount(0);
    }
  };

  const pauseTimer = () => {
    setIsPaused(true);
  };

  const continueTimer = () => {
    setIsPaused(false);
  };

  const resetTimer = () => {
    setMode('idle');
    setTimeLeft(25 * 60);
    setIsPaused(false);
    setSessionCount(0);
  };

  const addTask = () => {
    if (newTaskText.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText.trim(),
        completed: false,
        sessionsCompleted: 0
      };
      setTasks([...tasks, newTask]);
      setNewTaskText('');
    }
  };

  const toggleTaskComplete = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    if (currentTaskId === taskId) {
      setCurrentTaskId(null);
    }
  };

  const selectTask = (taskId: string) => {
    setCurrentTaskId(taskId);
  };

  const switchToBreak = () => {
    setMode('break');
    setTimeLeft(5 * 60);
    setIsPaused(false);
  };

  const switchToSession = () => {
    setMode('session');
    setTimeLeft(25 * 60);
    setIsPaused(false);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    const totalTime = mode === 'session' ? 25 * 60 : 5 * 60;
    const elapsed = totalTime - timeLeft;
    return (elapsed / totalTime) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Timer Display */}
      <div className="text-center">
        <div className={`my-8 text-6xl font-bold ${
          mode === 'break' ? 'text-green-500' : 
          mode === 'session' ? 'text-blue-500' : 
          'text-gray-500'
        }`}>
          {formatTime(timeLeft)}
        </div>
        
        {/* Progress Bar */}
        {(mode === 'session' || mode === 'break') && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4 max-w-md mx-auto">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ease-linear ${
                mode === 'break' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        )}
        
        <div className="mb-4 text-xl font-semibold capitalize">
          {mode === 'idle' ? 'Ready to start?' : 
           mode === 'session' ? `Study Session ${sessionCount + 1}/${Math.ceil(duration / 25)}` : 
           'Break Time'}
        </div>
        
        {/* Mode Selection */}
        <div className="flex gap-2 justify-center mb-4">
          <button
            onClick={() => mode === 'idle' ? null : switchToSession()}
            className={`px-8 py-3 rounded font-bold transition-colors text-lg ${
              mode === 'idle' 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-not-allowed opacity-50'
                : mode === 'session' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={mode === 'idle'}
          >
            Session
          </button>
          <button
            onClick={() => mode === 'idle' ? null : switchToBreak()}
            className={`px-8 py-3 rounded font-bold transition-colors text-lg ${
              mode === 'idle' 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-not-allowed opacity-50'
                : mode === 'break' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            disabled={mode === 'idle'}
          >
            Break
          </button>
        </div>
        
        {/* Single Start/Pause Button with Reset - Fixed Position */}
        <div className="flex gap-3 justify-center items-center">
          {/* Refresh button - always first position */}
          <button
            onClick={resetTimer}
            className="rounded bg-gray-500 py-3 px-3 font-bold text-white hover:bg-gray-600 transition-colors"
            title="Reset Timer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          {/* Main action button - always second position */}
          {mode === 'idle' && (
            <button
              onClick={() => startTimer('session')}
              className="rounded bg-blue-500 py-3 px-8 font-bold text-white hover:bg-blue-700 transition-colors text-lg"
            >
              Start
            </button>
          )}
          
          {(mode === 'session' || mode === 'break') && (
            !isPaused ? (
              <button
                onClick={pauseTimer}
                className="rounded bg-yellow-500 py-3 px-8 font-bold text-white hover:bg-yellow-600 transition-colors text-lg"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={continueTimer}
                className="rounded bg-green-500 py-3 px-8 font-bold text-white hover:bg-green-600 transition-colors text-lg"
              >
                Start
              </button>
            )
          )}
        </div>
        
        {/* Session Counter */}
        {mode !== 'idle' && (
          <div className="mt-4 text-sm text-gray-600">
            Pomodoro {sessionCount + 1} completed
          </div>
        )}
      </div>

      {/* Task Management */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Tasks</h3>
        
        {/* Add Task */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addTask}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
        
        {/* Task List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No tasks yet. Add one above!</p>
          ) : (
            tasks.map(task => (
              <div 
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  currentTaskId === task.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTaskComplete(task.id)}
                  className="w-4 h-4"
                />
                <span 
                  className={`flex-1 cursor-pointer ${
                    task.completed ? 'line-through text-gray-500' : ''
                  }`}
                  onClick={() => selectTask(task.id)}
                >
                  {task.text}
                </span>
                <span className="text-xs text-gray-500">
                  {task.sessionsCompleted} sessions
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

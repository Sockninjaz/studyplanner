'use client';

import { useState, useEffect } from 'react';

interface Props {
  duration: number; // in minutes
  onComplete: () => void;
}

export default function Timer({ duration, onComplete }: Props) {
  const [mode, setMode] = useState<'idle' | 'session' | 'break'>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // Default to 25 minutes
  const [isPaused, setIsPaused] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    if (mode === 'idle' || isPaused) return;

    if (timeLeft <= 0) {
      if (mode === 'session') {
        // Session completed, start break
        setMode('break');
        setTimeLeft(5 * 60); // 5-minute break
      } else {
        // Break completed, check if we should continue
        setSessionCount(prev => prev + 1);
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
  }, [mode, timeLeft, duration, onComplete, isPaused, sessionCount]);

  const startTimer = () => {
    setMode('session');
    setTimeLeft(25 * 60);
    setIsPaused(false);
    setSessionCount(0);
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
      
      <div className="flex gap-3 justify-center">
        {mode === 'idle' && (
          <button
            onClick={startTimer}
            className="rounded bg-blue-500 py-2 px-6 font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Start Learning
          </button>
        )}
        
        {(mode === 'session' || mode === 'break') && (
          <>
            {!isPaused ? (
              <button
                onClick={pauseTimer}
                className="rounded bg-yellow-500 py-2 px-6 font-bold text-white hover:bg-yellow-600 transition-colors"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={continueTimer}
                className="rounded bg-green-500 py-2 px-6 font-bold text-white hover:bg-green-600 transition-colors"
              >
                Continue
              </button>
            )}
            
            <button
              onClick={resetTimer}
              className="rounded bg-red-500 py-2 px-6 font-bold text-white hover:bg-red-600 transition-colors"
            >
              Reset
            </button>
          </>
        )}
      </div>
      
      {/* Session Counter */}
      {mode !== 'idle' && (
        <div className="mt-4 text-sm text-gray-600">
          Pomodoro {sessionCount + 1} completed
        </div>
      )}
    </div>
  );
}

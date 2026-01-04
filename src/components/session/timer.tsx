'use client';

import { useState, useEffect } from 'react';

interface Props {
  duration: number; // in minutes
  onComplete: () => void;
}

export default function Timer({ duration, onComplete }: Props) {
  const [mode, setMode] = useState<'session' | 'break' | 'idle'>('idle');
  const [timeLeft, setTimeLeft] = useState(duration * 60);

  useEffect(() => {
    if (mode === 'idle') return;

    if (timeLeft <= 0) {
      if (mode === 'session' && duration > 25) {
        setMode('break');
        setTimeLeft(5 * 60); // 5-minute break
      } else {
        setMode('idle');
        onComplete();
      }
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [mode, timeLeft, duration, onComplete]);

  const startTimer = () => {
    setMode('session');
    setTimeLeft(duration * 60);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-center">
      <div className={`my-8 text-6xl font-bold ${mode === 'break' ? 'text-green-500' : 'text-blue-500'}`}>
        {formatTime(timeLeft)}
      </div>
      <div className="mb-4 text-xl font-semibold capitalize">
        {mode === 'idle' ? 'Ready to start?' : `${mode} Time`}
      </div>
      {mode === 'idle' && (
        <button
          onClick={startTimer}
          className="rounded bg-blue-500 py-2 px-6 font-bold text-white hover:bg-blue-700"
        >
          Start Learning
        </button>
      )}
    </div>
  );
}

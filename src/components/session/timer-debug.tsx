'use client';
import { useTimer } from './timer-context';

export function TimerDebug() {
  const { activeSessionId, mode, timeLeft, isPaused } = useTimer();
  return (
    <div>
      <div>ID: {activeSessionId || 'NULL'}</div>
      <div>Mode: {mode}</div>
      <div>Time: {timeLeft}</div>
      <div>Paused: {isPaused ? 'Y' : 'N'}</div>
    </div>
  );
}

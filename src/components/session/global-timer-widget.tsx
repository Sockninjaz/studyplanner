'use client';

import React from 'react';
import { useTimer } from './timer-context';
import { useRouter, usePathname } from 'next/navigation';

export default function GlobalTimerWidget() {
  const { activeSessionId, activeSessionData, mode, timeLeft, isPaused } = useTimer();
  const router = useRouter();
  const pathname = usePathname();

  // Don't show if there's no active session or if we are idle
  if (!activeSessionId || mode === 'idle') return null;

  // Don't show if we are actually ON the session execution page for this session
  if (pathname === `/session/${activeSessionId}`) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isSession = mode === 'session';
  const colorClass = isSession ? 'bg-blue-500' : 'bg-green-500';
  const hoverClass = isSession ? 'hover:bg-blue-600' : 'hover:bg-green-600';
  const pulseClass = isPaused ? '' : 'animate-pulse';

  return (
    <div 
      onClick={() => router.push(`/session/${activeSessionId}`)}
      className={`fixed bottom-6 right-6 z-[9999] flex cursor-pointer items-center gap-2 rounded-full ${colorClass} ${hoverClass} px-3 py-1.5 text-white shadow-lg transition-all transform hover:scale-105 max-w-[180px]`}
      title="Return to Active Session"
    >
      <div className={`h-2 w-2 flex-shrink-0 rounded-full bg-white ${pulseClass}`} />
      
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-90 leading-tight truncate">
          {activeSessionData?.title || 'Active Session'}
        </span>
        <span className="font-mono text-sm font-bold leading-tight">
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
}

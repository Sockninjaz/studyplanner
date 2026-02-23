/**
 * Utility functions for handling historical vs future study sessions
 * during schedule recalculation.
 */

interface SessionDocument {
  _id: any;
  exam: any;
  startTime: Date;
  endTime: Date;
  isCompleted: boolean;
  [key: string]: any;
}

interface SeparatedSessions {
  /** All completed sessions (any date) - locked, never deleted */
  completedSessions: SessionDocument[];
  /** Past uncompleted sessions - frozen, hours treated as missed */
  missedSessions: SessionDocument[];
  /** Future/today uncompleted sessions - will be deleted and rescheduled */
  reschedulableSessions: SessionDocument[];
  /** Total completed hours per exam (from all completed sessions) */
  completedHours: { [examId: string]: number };
}

/**
 * Get today's date string in YYYY-MM-DD format (local timezone).
 */
export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Separates sessions into three categories:
 * 
 * - Completed (any date, isCompleted=true): locked, count as done, never deleted
 * - Missed (date < today, isCompleted=false): frozen in place, hours redistributed
 * - Reschedulable (date >= today, isCompleted=false): deleted and rescheduled
 * 
 * Also calculates completed hours per exam from all completed sessions.
 */
export function separateSessions(sessions: SessionDocument[]): SeparatedSessions {
  const todayStr = getTodayDateStr();

  const completedSessions: SessionDocument[] = [];
  const missedSessions: SessionDocument[] = [];
  const reschedulableSessions: SessionDocument[] = [];
  const completedHours: { [examId: string]: number } = {};

  for (const s of sessions) {
    const sessionDateStr = s.startTime.toISOString().split('T')[0];

    if (s.isCompleted) {
      // Completed sessions are always locked regardless of date
      completedSessions.push(s);
      const examId = s.exam.toString();
      const duration = (s.endTime.getTime() - s.startTime.getTime()) / (1000 * 3600);
      completedHours[examId] = (completedHours[examId] || 0) + duration;
    } else if (sessionDateStr < todayStr) {
      // Past uncompleted sessions are missed work
      missedSessions.push(s);
    } else {
      // Future/today uncompleted sessions can be rescheduled
      reschedulableSessions.push(s);
    }
  }

  return { completedSessions, missedSessions, reschedulableSessions, completedHours };
}

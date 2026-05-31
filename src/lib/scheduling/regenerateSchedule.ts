import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import BlockedDay from '@/models/BlockedDay';
import { generateAISchedule } from '@/lib/scheduling/aiScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';

export async function regenerateSchedule(user: any, overridePrefs: any = {}) {
  await dbConnect();

  // Get all user exams
  const allExams = await Exam.find({ user: user._id });

  if (allExams.length === 0) {
    return { success: true, message: 'No exams found to schedule', sessionsLength: 0 };
  }

  // Separate historical/future sessions for exams
  const allSessions = await StudySession.find({ user: user._id });
  const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(allSessions);

  console.log(`Regenerate request - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);

  // Delete reschedulable sessions (future/today) and missed sessions (past uncompleted)
  const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
  if (sessionsToDelete.length > 0) {
    await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
    console.log(`Deleted ${reschedulableSessions.length} reschedulable and ${missedSessions.length} missed sessions for regeneration`);
  }

  // Re-fetch remaining locked sessions (completed + missed) for deduplication
  const lockedSessions = await StudySession.find({ user: user._id });

  const userInputs: any = {
    daily_max_hours: overridePrefs.daily_max_hours || user.daily_study_limit || 4,
    soft_daily_limit: overridePrefs.soft_daily_limit || user.soft_daily_limit || 2,
    adjustment_percentage: overridePrefs.adjustment_percentage || user.adjustment_percentage || 25,
    session_duration: overridePrefs.session_duration || user.session_duration || 30,
    enable_daily_limits: overridePrefs.enable_daily_limits !== undefined ? overridePrefs.enable_daily_limits : user.enable_daily_limits,
    start_date: new Date(),
    existing_sessions: reschedulableSessions.map((s: any) => ({
      examId: s.exam.toString(),
      content: s.title
    })),
    completed_hours: completedHours,
    exams: allExams.map(e => ({
      id: e._id.toString(),
      subject: e.subject,
      exam_date: e.date,
      totalHours: e.studyMaterials.reduce((sum: number, m: any) => sum + (m.user_estimated_total_hours || 0), 0) || 5,
      can_study_after_exam: e.can_study_after_exam,
      studyMaterials: e.studyMaterials || [],
    })),
  };

  // Fetch blocked days for this user
  const blockedDayDocs = await BlockedDay.find({ user: user._id });
  userInputs.blocked_days = blockedDayDocs.map((bd: any) => bd.date.toISOString().split('T')[0]);

  const aiSchedule = await generateAISchedule(userInputs);

  let overloadWarning: string | null = null;
  let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

  const sessionDurationMinutes = userInputs.session_duration;
  const sessionsToSave: any[] = [];
  const maxSessionsPerDay = Math.floor(userInputs.daily_max_hours / (sessionDurationMinutes / 60));
  const dailySessionCounts: { [date: string]: number } = {};

  for (const [dateStr, dayMap] of Array.from(aiSchedule.entries())) {
    let daySessionCount = 0;
    
    for (const [examId, sessionsArr] of Array.from(dayMap.entries())) {
      const numChunks = sessionsArr.length;
      dailySessionCounts[dateStr] = (dailySessionCounts[dateStr] || 0) + numChunks;

      const examForSubject = allExams.find(e => e._id.toString() === examId);
      if (examForSubject) {
        // Check locked sessions for this subject on this day to avoid recreating them
        const lockedForDay = lockedSessions.filter(s =>
          s.exam.toString() === examId &&
          s.startTime.toISOString().split('T')[0] === dateStr
        );
        
        // We iterate through the AI recommended sessions array
        const startIndex = lockedForDay.length;
        const sessionsToCreate = sessionsArr.slice(startIndex);

        for (let i = 0; i < sessionsToCreate.length; i++) {
          const sessionData = sessionsToCreate[i];
          
          // Parse date string (assumes UTC to avoid timezone shift on init)
          const [year, month, day] = dateStr.split('-').map(Number);
          const sessionStart = new Date(year, month - 1, day);
          
          // Stagger sessions to avoid overlap (start at 9AM, add session_duration intervals)
          sessionStart.setHours(9, (daySessionCount + lockedForDay.length) * sessionDurationMinutes, 0, 0);
          const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60000);

          // The title becomes exactly what the AI proposed
          const exactTitle = sessionData.content || `Study: ${examForSubject.subject}`;

          sessionsToSave.push({
            user: user._id,
            exam: examForSubject._id,
            title: exactTitle, // Use granular AI title
            subject: examForSubject.subject,
            startTime: sessionStart,
            endTime: sessionEnd,
            isCompleted: false,
          });
          daySessionCount++;
        }
      }
    }
  }

  // Check for overloaded days
  for (const [dateStr, count] of Object.entries(dailySessionCounts)) {
    if (count > maxSessionsPerDay) {
      overloadedDays.push({ date: dateStr, sessions: count, limit: maxSessionsPerDay });
    }
  }
  if (overloadedDays.length > 0) {
    overloadWarning = `${overloadedDays.length} day(s) exceed your daily session limit.`;
  }

  if (sessionsToSave.length > 0) {
    await StudySession.insertMany(sessionsToSave);
    console.log(`Regenerated ${sessionsToSave.length} AI sessions`);
  }

  return { success: true, sessionsLength: sessionsToSave.length, overloadWarning, overloadedDays, sessionsToSave };
}

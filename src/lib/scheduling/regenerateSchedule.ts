import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import BlockedDay from '@/models/BlockedDay';
import { generateAISchedule } from '@/lib/scheduling/aiScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import { compressSchedule, compressSessionsInMemory } from '@/lib/scheduling/compressSchedule';
import { generateSessionDetails } from '@/lib/ai/generateSessionDetails';

export async function regenerateSchedule(
  user: any, 
  overridePrefs: any = {}, 
  forceRegenerateExamId?: string,
  action?: 'check' | 'compress' | 'allowOverload'
) {
  await dbConnect();

  // Get all active user exams (ignore completed exams so we don't schedule new sessions for them)
  const allExams = await Exam.find({ user: user._id, isCompleted: { $ne: true } });

  // Separate historical/future sessions for exams early so we can clean up ghost sessions if no exams exist
  const allSessions = await StudySession.find({ user: user._id });
  const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(allSessions);

  if (allExams.length === 0) {
    const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
    if (sessionsToDelete.length > 0 && action !== 'check') {
      await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
      console.log(`Cleaned up ${sessionsToDelete.length} orphan sessions as no exams remain.`);
    }
    return { success: true, message: 'No exams found to schedule', sessionsLength: 0 };
  }

  console.log(`Regenerate request [${action || 'default'}] - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);

  // Delete reschedulable sessions (future/today) and missed sessions (past uncompleted) ONLY if we are actually saving
  const sessionsToDelete = [...reschedulableSessions, ...missedSessions];
  if (sessionsToDelete.length > 0 && action !== 'check') {
    await StudySession.deleteMany({ _id: { $in: sessionsToDelete.map(s => s._id) } });
    console.log(`Deleted ${reschedulableSessions.length} reschedulable and ${missedSessions.length} missed sessions for regeneration`);
  }

  // Re-fetch remaining locked sessions (completed + missed) for deduplication
  // If we are in 'check' mode, the missed sessions are still in the DB, so we should exclude them from lockedSessions artificially
  const activeExamIds = allExams.map(e => e._id);
  const lockedSessions = action === 'check' 
    ? allSessions.filter(s => !sessionsToDelete.some(td => td._id.toString() === s._id.toString()) && activeExamIds.some(id => id.toString() === s.exam.toString()))
    : await StudySession.find({ user: user._id, exam: { $in: activeExamIds } });

  const userInputs: any = {
    daily_max_hours: overridePrefs.daily_max_hours || user.daily_study_limit || 4,
    soft_daily_limit: overridePrefs.soft_daily_limit || user.soft_daily_limit || 2,
    adjustment_percentage: overridePrefs.adjustment_percentage || user.adjustment_percentage || 25,
    session_duration: overridePrefs.session_duration || user.session_duration || 30,
    enable_daily_limits: overridePrefs.enable_daily_limits !== undefined ? overridePrefs.enable_daily_limits : user.enable_daily_limits,
    start_date: new Date(),
    completed_hours: completedHours,
    exams: allExams.map(e => ({
      id: e._id.toString(),
      subject: e.subject,
      exam_date: e.date,
      totalHours: (e.studyMaterials || []).reduce((sum: number, m: any) => sum + (m.user_estimated_total_hours || 0), 0) || 5,
      can_study_after_exam: e.can_study_after_exam,
      studyMaterials: e.studyMaterials || [],
    })),
    allowOverload: action === 'allowOverload'
  };

  // Fetch blocked days for this user
  const blockedDayDocs = await BlockedDay.find({ user: user._id });
  userInputs.blocked_days = blockedDayDocs.map((bd: any) => bd.date.toISOString().split('T')[0]);

  const { schedule: aiScheduleMap, wasOverloaded } = await generateAISchedule(userInputs);
  console.log(`[DEBUG] aiScheduleMap size: ${aiScheduleMap.size}`);

  let overloadWarning: string | null = null;
  let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

  const sessionsToSave: any[] = [];
  const maxMinutesPerDay = userInputs.daily_max_hours * 60;
  const dailySessionMinutes: { [date: string]: number } = {};

  for (const [dateStr, dayMap] of Array.from(aiScheduleMap.entries())) {
    let dayOffsetMinutes = 0;
    
    // Account for ALL locked sessions on this day across ALL exams
    const allLockedForDay = lockedSessions.filter(s => 
      s.startTime.toISOString().split('T')[0] === dateStr
    );
    for (const locked of allLockedForDay) {
      dayOffsetMinutes += Math.round((locked.endTime.getTime() - locked.startTime.getTime()) / 60000);
    }
    
    for (const [examId, sessionsArr] of Array.from(dayMap.entries())) {
      const examForSubject = allExams.find(e => e._id.toString() === examId);
      console.log(`[DEBUG] Date: ${dateStr}, Exam: ${examId}, Sessions in AI output: ${sessionsArr.length}, Exam exists: ${!!examForSubject}`);
      
      if (examForSubject) {
        const lockedForDay = lockedSessions.filter(s =>
          s.exam.toString() === examId &&
          s.startTime.toISOString().split('T')[0] === dateStr
        );
        
        const sessionsToCreate = sessionsArr;

        for (const sessionData of sessionsToCreate) {
          const duration = (sessionData as any).durationMinutes || userInputs.session_duration;
          dailySessionMinutes[dateStr] = (dailySessionMinutes[dateStr] || 0) + duration;

          const [year, month, day] = dateStr.split('-').map(Number);
          const sessionStart = new Date(year, month - 1, day);
          
          sessionStart.setHours(9, dayOffsetMinutes, 0, 0);
          const sessionEnd = new Date(sessionStart.getTime() + duration * 60000);
          const exactTitle = sessionData.content || `Study: ${examForSubject.subject}`;

          // Find matching study material for AI enrichment metadata
          const matchingMaterial = (examForSubject.studyMaterials || []).find(
            (m: any) => exactTitle.includes(m.chapter)
          );

          sessionsToSave.push({
            user: user._id,
            exam: examForSubject._id,
            title: exactTitle,
            subject: examForSubject.subject,
            startTime: sessionStart,
            endTime: sessionEnd,
            isCompleted: false,
            // Temporary metadata for AI enrichment (not persisted — removed before insertMany)
            _enrichMeta: {
              chapter: exactTitle,
              difficulty: matchingMaterial?.difficulty || 3,
              formulas: matchingMaterial?.formulas || [],
            },
          });
          
          dayOffsetMinutes += duration;
        }
      }
    }
  }

  console.log(`[DEBUG] Final sessionsToSave length: ${sessionsToSave.length}`);

  for (const [dateStr, totalMins] of Object.entries(dailySessionMinutes)) {
    if (totalMins > maxMinutesPerDay) {
      overloadedDays.push({ date: dateStr, sessions: Math.round(totalMins / 60), limit: userInputs.daily_max_hours });
    }
  }

  if (action === 'check') {
    if (wasOverloaded || overloadedDays.length > 0) {
      return { success: true, requiresDecision: true, wasOverloaded, overloadedDays };
    }
    return { success: true, requiresDecision: false };
  }

  if (overloadedDays.length > 0) {
    overloadWarning = `${overloadedDays.length} day(s) exceed your daily session limit.`;
  } else if (wasOverloaded) {
    overloadWarning = `To prevent exceeding your daily max limit, we dropped the final review session and condensed some of your topics to fit your timeline.`;
  }

  let finalSessionsToSave = sessionsToSave;

  if (action === 'compress') {
    finalSessionsToSave = compressSessionsInMemory(sessionsToSave, userInputs.daily_max_hours);
    console.log(`[Compress] Compressed ${sessionsToSave.length} raw sessions down to ${finalSessionsToSave.length} merged sessions to fit daily limit.`);
  }

  if (finalSessionsToSave.length > 0) {
    // Enrich sessions with AI-generated descriptive titles and task checklists
    const enrichInputs = finalSessionsToSave.map((s, i) => ({
      index: i,
      subject: s.subject,
      chapter: s._enrichMeta?.chapter || s.title,
      difficulty: s._enrichMeta?.difficulty || 3,
      formulas: s._enrichMeta?.formulas || [],
    }));

    const enriched = await generateSessionDetails(enrichInputs);

    // Apply AI enrichment and strip the temp _enrichMeta field before saving
    for (const session of finalSessionsToSave) {
      const detail = enriched.find(e => e.index === finalSessionsToSave.indexOf(session));
      if (detail) {
        session.shortTitle = detail.shortTitle;
        session.title = detail.fullTitle;
        session.tasks = detail.tasks.map((text, i) => ({
          id: `task-${i}`,
          text,
          completed: false,
          sessionsCompleted: 0,
        }));
      }
      delete session._enrichMeta;
    }

    await StudySession.insertMany(finalSessionsToSave);
    console.log(`Regenerated ${finalSessionsToSave.length} AI sessions with enriched titles and tasks`);
  }

  return { success: true, sessionsLength: finalSessionsToSave.length, overloadWarning, overloadedDays, sessionsToSave: finalSessionsToSave };
}

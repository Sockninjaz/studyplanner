import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import BlockedDay from '@/models/BlockedDay';
import { generateAISchedule } from '@/lib/scheduling/aiScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import { compressSessionsInMemory } from '@/lib/scheduling/compressSchedule';
import { generateSessionDetails } from '@/lib/ai/generateSessionDetails';

// Per-user execution lock to serialize concurrent regenerations
const userLocks = new Map<string, Promise<any>>();

export async function regenerateSchedule(
  user: any, 
  overridePrefs: any = {}, 
  forceRegenerateExamId?: string,
  action?: 'check' | 'compress' | 'allowOverload'
) {
  const userId = user._id?.toString() || user.id?.toString();
  if (!userId) {
    return runRegenerateSchedule(user, overridePrefs, forceRegenerateExamId, action);
  }

  const currentPromise = userLocks.get(userId) || Promise.resolve();
  const nextPromise = (async () => {
    try {
      await currentPromise;
    } catch {
      // Ignore errors from previous queued task
    }
    return runRegenerateSchedule(user, overridePrefs, forceRegenerateExamId, action);
  })();

  userLocks.set(userId, nextPromise);

  try {
    return await nextPromise;
  } finally {
    if (userLocks.get(userId) === nextPromise) {
      userLocks.delete(userId);
    }
  }
}

async function runRegenerateSchedule(
  user: any, 
  overridePrefs: any = {}, 
  forceRegenerateExamId?: string,
  action?: 'check' | 'compress' | 'allowOverload'
) {
  await dbConnect();

  // Automatically mark exams as completed if their date is strictly before the start of today
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  await Exam.updateMany(
    { user: user._id, isCompleted: { $ne: true }, date: { $lt: startOfToday }, can_study_after_exam: { $ne: true } },
    { $set: { isCompleted: true, completedAt: now } }
  );

  // Get all active user exams (ignore completed exams so we don't schedule new sessions for them)
  const rawExams = await Exam.find({ user: user._id, isCompleted: { $ne: true } });

  // Deduplicate active exams by subject so orphaned duplicate exams (from re-saves) are cleaned up
  const examsBySubject = new Map<string, any>();
  for (const e of rawExams) {
    const key = (e.subject || '').trim().toLowerCase();
    if (!examsBySubject.has(key)) {
      examsBySubject.set(key, e);
    } else {
      const existing = examsBySubject.get(key);
      const existingTime = new Date((existing as any).updatedAt || (existing as any).createdAt || existing._id.getTimestamp()).getTime();
      const currentTime = new Date((e as any).updatedAt || (e as any).createdAt || e._id.getTimestamp()).getTime();

      if (currentTime > existingTime) {
        const oldId = existing._id;
        if (action !== 'check') {
          await Exam.deleteOne({ _id: oldId });
          await StudySession.deleteMany({ exam: oldId });
          console.log(`Deleted orphaned duplicate active exam ${oldId} for subject "${existing.subject}"`);
        }
        examsBySubject.set(key, e);
      } else {
        const oldId = e._id;
        if (action !== 'check') {
          await Exam.deleteOne({ _id: oldId });
          await StudySession.deleteMany({ exam: oldId });
          console.log(`Deleted orphaned duplicate active exam ${oldId} for subject "${e.subject}"`);
        }
      }
    }
  }
  const allExams = Array.from(examsBySubject.values());

  // If no exams remain, clean up any uncompleted sessions
  if (allExams.length === 0) {
    if (action !== 'check') {
      await StudySession.deleteMany({ user: user._id, isCompleted: { $ne: true } });
      console.log(`Cleaned up orphan uncompleted sessions as no active exams remain.`);
    }
    return { success: true, message: 'No exams found to schedule', sessionsLength: 0 };
  }

  // Separate historical/future sessions for exams to calculate completed hours
  const allSessions = await StudySession.find({ user: user._id });
  const { completedSessions, missedSessions, reschedulableSessions, completedHours } = separateSessions(allSessions);

  console.log(`Regenerate request [${action || 'default'}] - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);

  const activeExamIds = allExams.map(e => e._id);
  const lockedSessions = completedSessions.filter(s => activeExamIds.some(id => id.toString() === s.exam?.toString()));

  const isAllowOverload = action === 'allowOverload';
  const effectiveMaxHours = isAllowOverload ? 24 : (overridePrefs.daily_max_hours || user.daily_study_limit || 4);
  const effectiveSoftLimit = isAllowOverload ? 24 : (overridePrefs.soft_daily_limit || user.soft_daily_limit || 2);

  const userInputs: any = {
    daily_max_hours: effectiveMaxHours,
    soft_daily_limit: effectiveSoftLimit,
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
    allowOverload: isAllowOverload
  };

  // Fetch blocked days for this user
  const blockedDayDocs = await BlockedDay.find({ user: user._id });
  userInputs.blocked_days = blockedDayDocs.map((bd: any) => bd.date.toISOString().split('T')[0]);

  const { schedule: aiScheduleMap, wasOverloaded } = await generateAISchedule(userInputs);
  console.log(`[DEBUG] aiScheduleMap size: ${aiScheduleMap.size}`);

  let overloadWarning: string | null = null;
  let overloadedDays: { date: string; sessions: number; limit: number }[] = [];

  const sessionsToSave: any[] = [];
  const maxMinutesPerDay = effectiveMaxHours * 60;
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
      
      if (examForSubject) {
        const sessionsToCreate = sessionsArr;

        for (const sessionData of sessionsToCreate) {
          const rawDuration = (sessionData as any).durationMinutes || userInputs.session_duration || 45;
          // Strictly cap session duration between 30m and 90m (around 1h to 1.5h max)
          const duration = Math.min(90, Math.max(30, rawDuration));
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
              numMerged: 1,
              durationMinutes: duration,
            },
          });
          
          dayOffsetMinutes += duration;
        }
      }
    }
  }

  for (const [dateStr, totalMins] of Object.entries(dailySessionMinutes)) {
    if (totalMins > maxMinutesPerDay) {
      overloadedDays.push({ date: dateStr, sessions: Math.round(totalMins / 60), limit: userInputs.daily_max_hours });
    }
  }

  // If in check mode, return evaluation without modifying database
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
      numMerged: s._enrichMeta?.numMerged || 1,
      durationMinutes: s._enrichMeta?.durationMinutes || Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000),
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
  }

  // === ATOMIC DATABASE UPDATE & DEDUPLICATION ===
  // 1. Clean up duplicate or orphaned completed sessions
  
  // Get all valid exam IDs (active and completed) to prevent deleting sessions for completed exams
  const allUserExamsIds = (await Exam.find({ user: user._id }, '_id')).map(e => e._id.toString());
  const validExamIdStrings = new Set(allUserExamsIds);
  const activeExamIdStrings = new Set(allExams.map(e => e._id.toString()));
  
  const existingCompleted = await StudySession.find({ user: user._id, isCompleted: true });
  const seenCompletedKeys = new Set<string>();
  const duplicateCompletedIds: any[] = [];
  
  for (const cs of existingCompleted) {
    if (!cs.exam || !validExamIdStrings.has(cs.exam.toString())) {
      // Exam was completely deleted from DB
      duplicateCompletedIds.push(cs._id);
      continue;
    }
    
    // Only deduplicate sessions for ACTIVE exams. 
    // If the exam is completed, we just keep all its sessions intact.
    if (activeExamIdStrings.has(cs.exam.toString())) {
      const key = `${cs.exam.toString()}-${cs.startTime.toISOString()}-${cs.title}`;
      if (seenCompletedKeys.has(key)) {
        duplicateCompletedIds.push(cs._id);
      } else {
        seenCompletedKeys.add(key);
      }
    }
  }
  if (duplicateCompletedIds.length > 0) {
    await StudySession.deleteMany({ _id: { $in: duplicateCompletedIds } });
    console.log(`Cleaned up ${duplicateCompletedIds.length} orphaned/duplicate completed sessions.`);
  }

  // 2. Delete all existing uncompleted sessions atomically right before inserting the new schedule
  await StudySession.deleteMany({ user: user._id, isCompleted: { $ne: true } });

  // 3. Insert newly generated sessions
  if (finalSessionsToSave.length > 0) {
    await StudySession.insertMany(finalSessionsToSave);
    console.log(`Regenerated and inserted ${finalSessionsToSave.length} AI sessions cleanly.`);
  }

  return { success: true, sessionsLength: finalSessionsToSave.length, overloadWarning, overloadedDays, sessionsToSave: finalSessionsToSave };
}

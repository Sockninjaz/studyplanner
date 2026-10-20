import dbConnect from '@/lib/db';
import Exam from '@/models/Exam';
import StudySession from '@/models/StudySession';
import BlockedDay from '@/models/BlockedDay';
import { generateAISchedule } from '@/lib/scheduling/aiScheduler';
import { separateSessions } from '@/lib/scheduling/sessionUtils';
import { compressSessionsInMemory } from '@/lib/scheduling/compressSchedule';
import { generateSessionDetails } from '@/lib/ai/generateSessionDetails';
import {
  resolveStudyLanguage,
  getStudySessionPrefix,
  getDefaultFallbackTasks,
  getSingleFallbackTask,
  getRevisionFallbackTasks,
  getRevisionSessionTitles
} from '@/lib/i18n/resolveStudyLanguage';

// Per-user execution lock to serialize concurrent regenerations
const userLocks = new Map<string, Promise<any>>();

export interface RegenerateScheduleOptions {
  skipAiEnrichment?: boolean;
  checkOverload?: boolean;
}

export async function regenerateSchedule(
  user: any, 
  overridePrefs: any = {}, 
  forceRegenerateExamId?: string,
  action?: 'check' | 'compress' | 'allowOverload',
  options: RegenerateScheduleOptions = {}
) {
  const userId = user._id?.toString() || user.id?.toString();
  if (!userId) {
    return runRegenerateSchedule(user, overridePrefs, forceRegenerateExamId, action, options);
  }

  const currentPromise = userLocks.get(userId) || Promise.resolve();
  const nextPromise = (async () => {
    try {
      await currentPromise;
    } catch {
      // Ignore errors from previous queued task
    }
    return runRegenerateSchedule(user, overridePrefs, forceRegenerateExamId, action, options);
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
  action?: 'check' | 'compress' | 'allowOverload',
  options: RegenerateScheduleOptions = {}
) {
  await dbConnect();

  // Automatically mark exams as completed if their date is in the past
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const allUserExamsForCheck = await Exam.find({ user: user._id, isCompleted: { $ne: true } });
  const pastExamIds: any[] = [];
  for (const e of allUserExamsForCheck) {
    const eDate = new Date(e.date);
    const eDateStr = eDate.toISOString().split('T')[0];
    if (eDate < startOfToday || eDateStr < todayStr) {
      pastExamIds.push(e._id);
    }
  }

  if (pastExamIds.length > 0) {
    await Exam.updateMany(
      { _id: { $in: pastExamIds } },
      { $set: { isCompleted: true, completedAt: now } }
    );
    await StudySession.updateMany(
      { user: user._id, exam: { $in: pastExamIds } },
      { $set: { isCompleted: true } }
    );
    console.log(`Auto-marked ${pastExamIds.length} past exams and their sessions as completed.`);
  }

  // Get all active user exams (reuse loaded exams instead of redundant DB query)
  const pastExamIdStrings = new Set(pastExamIds.map(id => id.toString()));
  const rawExams = pastExamIds.length > 0
    ? allUserExamsForCheck.filter(e => !pastExamIdStrings.has(e._id.toString()))
    : allUserExamsForCheck;

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

  // Build in-memory lookup cache of existing session titles and task checklists to reuse details
  // and prevent repetitive, slow AI calls on non-AI requests (date changes, name changes, deletes, preferences)
  const existingDetailsByExamChapter = new Map<string, { shortTitle?: string; title: string; tasks?: any[] }>();
  const existingDetailsByChapter = new Map<string, { shortTitle?: string; title: string; tasks?: any[] }>();

  for (const s of allSessions) {
    const rawCh = (s.shortTitle || s.title || '')
      .replace(/^(study|studeren|lernen|étudier|estudiar):\s*/i, '')
      .replace(/^(.*?)\s*-\s*/, '')
      .trim()
      .toLowerCase();
    
    if (s.tasks && s.tasks.length > 0) {
      const detail = {
        shortTitle: s.shortTitle,
        title: s.title,
        tasks: s.tasks,
      };
      if (s.exam) {
        existingDetailsByExamChapter.set(`${s.exam.toString()}:::${rawCh}`, detail);
      }
      if (!existingDetailsByChapter.has(rawCh)) {
        existingDetailsByChapter.set(rawCh, detail);
      }
    }
  }

  console.log(`Regenerate request [${action || 'default'}] - Completed: ${completedSessions.length}, Missed: ${missedSessions.length}, Reschedulable: ${reschedulableSessions.length}`);

  const activeExamIds = allExams.map(e => e._id);
  const lockedSessions = completedSessions.filter(s => activeExamIds.some(id => id.toString() === s.exam?.toString()));

  const isAllowOverload = action === 'allowOverload';
  const effectiveMaxHours = isAllowOverload ? 24 : (overridePrefs.daily_max_hours ?? overridePrefs.daily_study_limit ?? user.daily_study_limit ?? 4);
  const effectiveSoftLimit = isAllowOverload ? 24 : (overridePrefs.soft_daily_limit ?? user.soft_daily_limit ?? 2);

  const userInputs: any = {
    daily_max_hours: effectiveMaxHours,
    soft_daily_limit: effectiveSoftLimit,
    adjustment_percentage: overridePrefs.adjustment_percentage ?? user.adjustment_percentage ?? 25,
    session_duration: overridePrefs.session_duration ?? user.session_duration ?? 30,
    enable_daily_limits: overridePrefs.enable_daily_limits !== undefined 
      ? overridePrefs.enable_daily_limits 
      : (user.enable_daily_limits !== false),
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
    allowOverload: isAllowOverload,
    userProfile: user?.onboardingProfile,
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
          const examLang = resolveStudyLanguage(user?.onboardingProfile, `${examForSubject.subject} ${(examForSubject.studyMaterials || []).map((m: any) => m.chapter).join(' ')}`);
          const prefix = getStudySessionPrefix(examLang);
          const exactTitle = sessionData.content || `${prefix}: ${examForSubject.subject}`;

          // Find matching study material for AI enrichment metadata
          const matchingMaterial = (examForSubject.studyMaterials || []).find(
            (m: any) => exactTitle.includes(m.chapter)
          );

          const isRevision = /herhaling|revision|proeftoets|review|eindtoets/i.test(exactTitle);
          const examChapters = (examForSubject.studyMaterials || []).map((m: any) => m.chapter).filter(Boolean);

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
              isRevision,
              examChapters,
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

  // Single-pass optimization: if checkOverload was requested and schedule is overloaded,
  // return early without modifying the database. If not overloaded, proceed cleanly to save.
  if (options.checkOverload && (wasOverloaded || overloadedDays.length > 0)) {
    return { success: true, requiresDecision: true, wasOverloaded, overloadedDays };
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
    const sessionsNeedingEnrichment: Array<{ session: any; originalIndex: number }> = [];

    // First pass: reuse existing cached session details or apply fast deterministic fallback if AI is skipped
    for (let i = 0; i < finalSessionsToSave.length; i++) {
      const session = finalSessionsToSave[i];
      const rawCh = (session._enrichMeta?.chapter || session.shortTitle || session.title || '')
        .replace(/^(study|studeren|lernen|étudier|estudiar):\s*/i, '')
        .replace(/^(.*?)\s*-\s*/, '')
        .trim()
        .toLowerCase();
      const examIdStr = session.exam?.toString() || '';

      const cached = existingDetailsByExamChapter.get(`${examIdStr}:::${rawCh}`) || existingDetailsByChapter.get(rawCh);

      const examLang = resolveStudyLanguage(user?.onboardingProfile, `${session.subject} ${session._enrichMeta?.chapter || session.title || ''}`);
      const prefix = getStudySessionPrefix(examLang);
      const isRev = session._enrichMeta?.isRevision || /herhaling|revision|proeftoets|review|eindtoets/i.test(session._enrichMeta?.chapter || session.title || '');
      const examChapters = session._enrichMeta?.examChapters || [];

      let validCached = cached;
      if (isRev && cached) {
        // Discard bad cached tasks from old naive templates (e.g. "Theorie en kernbegrippen doornemen voor Herhaling: ...")
        const hasBadRevisionTasks = cached.tasks?.some((t: any) => 
          /voor herhaling:|over herhaling:|for revision:|for herhaling:/i.test(t.text || t.task || '')
        );
        if (hasBadRevisionTasks) {
          validCached = undefined;
        }
      }

      if (validCached) {
        session.shortTitle = validCached.shortTitle || session._enrichMeta?.chapter || session.title;
        // Keep title matching current session subject if subject was renamed
        session.title = validCached.title.replace(/^(Study|Studeren|Lernen|Étudier|Estudiar): .+?($| \()/, `${prefix}: ${session.subject}$2`);
        session.tasks = validCached.tasks?.map((t: any, idx: number) => ({
          id: t.id || `task-${idx}`,
          text: t.text || t.task || '',
          completed: false,
          sessionsCompleted: 0,
        })) || [];
        delete session._enrichMeta;
      } else if (options.skipAiEnrichment) {
        if (isRev) {
          const revTitles = getRevisionSessionTitles(session.subject, examLang);
          session.shortTitle = revTitles.shortTitle;
          session.title = revTitles.fullTitle;
          session.tasks = getRevisionFallbackTasks(session.subject, examChapters, examLang);
        } else {
          const rawChapter = session._enrichMeta?.chapter || session.title || (examLang === 'nl' ? 'Studiesessie' : 'Study Session');
          session.shortTitle = rawChapter;
          session.title = /^(study|studeren|lernen|étudier|estudiar):/i.test(rawChapter)
            ? rawChapter
            : `${prefix}: ${session.subject} - ${rawChapter}`;
          session.tasks = getDefaultFallbackTasks(rawChapter, examLang);
        }
        delete session._enrichMeta;
      } else {
        sessionsNeedingEnrichment.push({ session, originalIndex: i });
      }
    }

    // Second pass: only call AI if there are actually sessions that need new enrichment
    if (sessionsNeedingEnrichment.length > 0 && !options.skipAiEnrichment) {
      console.log(`[Regenerate] Calling AI to enrich only ${sessionsNeedingEnrichment.length} new sessions out of ${finalSessionsToSave.length} total.`);
      const enrichInputs = sessionsNeedingEnrichment.map(({ session }, idx) => ({
        index: idx,
        subject: session.subject,
        chapter: session._enrichMeta?.chapter || session.title,
        difficulty: session._enrichMeta?.difficulty || 3,
        formulas: session._enrichMeta?.formulas || [],
        numMerged: session._enrichMeta?.numMerged || 1,
        durationMinutes: session._enrichMeta?.durationMinutes || Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000),
        isRevision: session._enrichMeta?.isRevision || /herhaling|revision|proeftoets|review|eindtoets/i.test(session._enrichMeta?.chapter || session.title || ''),
        examChapters: session._enrichMeta?.examChapters || [],
      }));

      try {
        const enriched = await generateSessionDetails(enrichInputs, user?.onboardingProfile);
        for (let idx = 0; idx < sessionsNeedingEnrichment.length; idx++) {
          const { session } = sessionsNeedingEnrichment[idx];
          const sessionLang = resolveStudyLanguage(user?.onboardingProfile, `${session.subject} ${session._enrichMeta?.chapter || session.title || ''}`);
          const sessionPrefix = getStudySessionPrefix(sessionLang);
          const isRev = session._enrichMeta?.isRevision || /herhaling|revision|proeftoets|review|eindtoets/i.test(session._enrichMeta?.chapter || session.title || '');
          const examChapters = session._enrichMeta?.examChapters || [];
          const detail = enriched.find(e => e.index === idx);
          if (detail) {
            if (isRev) {
              const revTitles = getRevisionSessionTitles(session.subject, sessionLang);
              session.shortTitle = detail.shortTitle || revTitles.shortTitle;
              session.title = detail.fullTitle || revTitles.fullTitle;
            } else {
              session.shortTitle = detail.shortTitle;
              session.title = detail.fullTitle;
            }
            session.tasks = detail.tasks.map((text, i) => ({
              id: `task-${i}`,
              text,
              completed: false,
              sessionsCompleted: 0,
            }));
          } else {
            if (isRev) {
              const revTitles = getRevisionSessionTitles(session.subject, sessionLang);
              session.shortTitle = revTitles.shortTitle;
              session.title = revTitles.fullTitle;
              session.tasks = getRevisionFallbackTasks(session.subject, examChapters, sessionLang);
            } else {
              const rawChapter = session._enrichMeta?.chapter || session.title || (sessionLang === 'nl' ? 'Studiesessie' : 'Study Session');
              session.shortTitle = rawChapter;
              session.title = `${sessionPrefix}: ${session.subject} - ${rawChapter}`;
              session.tasks = [getSingleFallbackTask(rawChapter, sessionLang)];
            }
          }
          delete session._enrichMeta;
        }
      } catch (aiErr) {
        console.error('[Regenerate] AI enrichment failed, falling back to clean titles/tasks:', aiErr);
        for (const { session } of sessionsNeedingEnrichment) {
          const sessionLang = resolveStudyLanguage(user?.onboardingProfile, `${session.subject} ${session._enrichMeta?.chapter || session.title || ''}`);
          const sessionPrefix = getStudySessionPrefix(sessionLang);
          const isRev = session._enrichMeta?.isRevision || /herhaling|revision|proeftoets|review|eindtoets/i.test(session._enrichMeta?.chapter || session.title || '');
          const examChapters = session._enrichMeta?.examChapters || [];

          if (isRev) {
            const revTitles = getRevisionSessionTitles(session.subject, sessionLang);
            session.shortTitle = revTitles.shortTitle;
            session.title = revTitles.fullTitle;
            session.tasks = getRevisionFallbackTasks(session.subject, examChapters, sessionLang);
          } else {
            const rawChapter = session._enrichMeta?.chapter || session.title || (sessionLang === 'nl' ? 'Studiesessie' : 'Study Session');
            session.shortTitle = rawChapter;
            session.title = `${sessionPrefix}: ${session.subject} - ${rawChapter}`;
            session.tasks = [getSingleFallbackTask(rawChapter, sessionLang)];
          }
          delete session._enrichMeta;
        }
      }
    } else {
      console.log(`[Regenerate] Reused cached session details for all ${finalSessionsToSave.length} sessions (0 AI requests).`);
    }
  }

  // === ATOMIC DATABASE UPDATE & DEDUPLICATION ===
  // 1. Clean up duplicate or orphaned completed sessions
  
  // Get all valid exam IDs (active and completed) to prevent deleting sessions for completed exams
  const allUserExamsIds = (await Exam.find({ user: user._id }, '_id').lean()).map(e => e._id.toString());
  const validExamIdStrings = new Set(allUserExamsIds);
  const activeExamIdStrings = new Set(allExams.map(e => e._id.toString()));
  
  // Reuse completedSessions already loaded in memory instead of running a duplicate query!
  const existingCompleted = completedSessions;
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
      const key = `${cs.exam.toString()}-${new Date(cs.startTime).toISOString()}-${cs.title}`;
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

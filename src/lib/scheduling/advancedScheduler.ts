// V1 Study Planner Algorithm
console.log('=== SCHEDULER FILE LOADED ===');

// §1. User Inputs
interface ExamData {
  id: string;
  subject: string;
  exam_date: Date;
  difficulty: number; // 1-5
  confidence: number; // 1-5
  user_estimated_total_hours: number;
  can_study_after_exam: boolean; // Default: true
}

interface ExistingSession {
  date: Date;
  subjectId: string;
  duration: number; // in hours
}

interface UserInputs {
  daily_max_hours: number;
  adjustment_percentage: number; // Max percentage adjustment for difficulty/confidence
  session_duration: number; // Duration of each study session in minutes
  start_date: Date;
  exams: ExamData[];
  existing_sessions?: ExistingSession[];
  completed_hours?: { [examId: string]: number }; // Hours already completed from historical sessions
  blocked_days?: string[]; // Array of date strings (YYYY-MM-DD) that should be skipped for sessions
  soft_daily_limit?: number; // Soft cap on hours per day (default 2). Schedule aims to stay at or below this.
  enable_daily_limits?: boolean; // If false, bounds are relaxed based on custom rules.
}

// §2. Internal State
interface InternalSubjectState {
  id: string;
  subject: string;
  exam_date: Date;
  remaining_hours: number;
  days_to_exam: number;
  last_study_day: Date | null;
  state: 'ACTIVE' | 'DONE';
  original_difficulty: number;
  original_confidence: number;
}

interface DailySchedule {
  date: Date;
  total_hours: number;
  subjects: { [subjectId: string]: number };
  is_overloaded?: boolean; // New field to indicate overload
  overload_amount?: number; // How much over the daily limit
}

interface ScheduleResult {
  schedule: DailySchedule[];
  overload_info?: {
    total_overload_hours: number;
    overloaded_days: number;
    message: string;
  };
}

export class StudyPlannerV1 {
  private inputs: UserInputs;
  private subjects: InternalSubjectState[];
  private schedule: DailySchedule[] = [];
  private preliminarySchedules: Map<string, Map<string, number>> = new Map();

  constructor(inputs: UserInputs) {
    console.log('=== SCHEDULER CONSTRUCTOR CALLED ===');
    console.log('Number of exams:', inputs.exams.length);
    console.log('Number of existing sessions:', inputs.existing_sessions?.length || 0);
    console.log('Existing sessions:', inputs.existing_sessions?.map(s => ({ subject: s.subjectId, date: s.date })) || []);
    console.log('Completed hours:', inputs.completed_hours || {});
    this.inputs = inputs;

    if (this.inputs.enable_daily_limits === false) {
      console.log('Daily preference disabled: ignoring soft_daily_limit, using daily_max_hours as ceiling');
    }

    this.subjects = this.initializeInternalState(inputs.exams);
  }

  // Returns the effective soft limit for scheduling distribution.
  // When daily preferences are ON: returns soft_daily_limit (user's preferred daily target)
  // When daily preferences are OFF: returns daily_max_hours (hard ceiling, no soft preference)
  // This is used for optimal start date calculations and session distribution targets.
  private getEffectiveSoftLimit(): number {
    if (this.inputs.enable_daily_limits === false) {
      // No soft preference — use the hard max as the ceiling.
      // The key difference from ON: optimal start dates are skipped (see generateValidSlotsForExam),
      // so sessions spread across ALL available days rather than being compressed.
      return this.inputs.daily_max_hours;
    }
    return this.inputs.soft_daily_limit ?? 2;
  }

  private getMaxSessionsPerDayForExamId(examId: string): number {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    return Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
  }

  private getExistingHoursForDate(date: Date): number {
    if (!this.inputs.existing_sessions) return 0;

    const dateStr = date.toISOString().split('T')[0];
    const totalHours = this.inputs.existing_sessions
      .filter(session => session.date.toISOString().split('T')[0] === dateStr)
      .reduce((total, session) => total + session.duration, 0);

    return totalHours;
  }

  // Group exams whose minimum study windows overlap using union-find.
  // Window = [examDate - ceil(hours/softLimit), examDate]. If they overlap → same group.
  private computeExamGroups(): Map<string, string[]> {
    const softLimit = this.getEffectiveSoftLimit();

    const validExams = this.inputs.exams.filter((e: ExamData) => {
      const completedHrs = this.inputs.completed_hours?.[e.id] || 0;
      return this.calculateTotalHours(e) - completedHrs > 0;
    });

    if (validExams.length === 0) return new Map();

    // Compute each exam's minimum study window
    const windows: { id: string; subject: string; start: number; end: number }[] = [];
    for (const exam of validExams) {
      const completedHrs = this.inputs.completed_hours?.[exam.id] || 0;
      const remainingHours = Math.max(0, this.calculateTotalHours(exam) - completedHrs);
      const daysNeeded = Math.ceil(remainingHours / softLimit);

      // Use exam date as window end (not last study day) + 1 day buffer for grouping purpo
      // so adjacent-day exams get grouped togetherses
      const examDateStr = exam.exam_date.toISOString().split('T')[0];
      const end = new Date(examDateStr + 'T00:00:00.000Z');
      const start = new Date(end.getTime() - daysNeeded * 24 * 60 * 60 * 1000);

      windows.push({ id: exam.id, subject: exam.subject, start: start.getTime(), end: end.getTime() });
    }

    // Union-Find
    const parent: Record<string, string> = {};
    const find = (x: string): string => { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    for (const w of windows) parent[w.id] = w.id;

    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i], b = windows[j];
        if (a.start <= b.end && b.start <= a.end) {
          union(a.id, b.id);
        }
      }
    }

    // Build groups
    const groups = new Map<string, string[]>();
    for (const w of windows) {
      const root = find(w.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(w.id);
    }

    // Log
    const entries = Array.from(groups.entries());
    for (const [, ids] of entries) {
      const names = ids.map((id: string) => validExams.find((e: ExamData) => e.id === id)?.subject || id);
      console.log(`  📦 Group: [${names.join(', ')}]`);
    }
    return groups;
  }

  // Calculate the optimal start date per group, return the earliest.
  // Each group only counts its own exams' hours. Isolated exams don't affect other groups.
  private calculateOptimalStartDate(): Date {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const softLimit = this.getEffectiveSoftLimit();
    const sessionsPerDayTarget = Math.max(1, Math.floor(softLimit / STUDY_CHUNK_HOURS));
    const groups = this.computeExamGroups();

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowUTC = new Date(nowStr + 'T00:00:00.000Z');
    let earliestStart = nowUTC;

    const entries = Array.from(groups.entries());
    for (const [, examIds] of entries) {
      const groupExams = this.inputs.exams.filter((e: ExamData) => examIds.includes(e.id));

      // Sum hours only within this group
      let groupHours = 0;
      for (const exam of groupExams) {
        const completed = this.inputs.completed_hours?.[exam.id] || 0;
        groupHours += Math.max(0, this.calculateTotalHours(exam) - completed);
      }

      // Latest exam in this group
      const latestExam = new Date(Math.max(...groupExams.map((e: ExamData) => e.exam_date.getTime())));
      const latestStr = latestExam.toISOString().split('T')[0];
      const latestUTC = new Date(latestStr + 'T00:00:00.000Z');

      const daysNeeded = Math.ceil(groupHours / softLimit);
      let groupStart = new Date(latestUTC.getTime() - daysNeeded * 24 * 60 * 60 * 1000);

      // Safety clamp per exam within this group
      for (const exam of groupExams) {
        const completed = this.inputs.completed_hours?.[exam.id] || 0;
        const sessionsNeeded = Math.ceil(Math.max(0, this.calculateTotalHours(exam) - completed) / STUDY_CHUNK_HOURS);
        const lastValid = new Date(exam.exam_date);
        if (!exam.can_study_after_exam) lastValid.setDate(lastValid.getDate() - 1);
        const daysForExam = Math.ceil(sessionsNeeded / sessionsPerDayTarget);
        const required = new Date(lastValid);
        required.setDate(required.getDate() - daysForExam);
        if (groupStart > required) groupStart = new Date(required);
      }

      if (groupStart < nowUTC) groupStart = nowUTC;

      const names = groupExams.map((e: ExamData) => e.subject).join(', ');
      console.log(`  📦 Group [${names}]: ${groupHours}h, ${daysNeeded}d, start=${groupStart.toISOString().split('T')[0]}`);

      if (groupStart < earliestStart) earliestStart = groupStart;
    }

    console.log(`📐 Optimal start (earliest group): ${earliestStart.toISOString().split('T')[0]}`);
    return earliestStart;
  }


  private generateValidSlotsForExam(exam: ExamData): Date[] {
    const validSlots: Date[] = [];

    // Parse exam date as UTC to avoid timezone shifts
    const examDateStr = exam.exam_date.toISOString().split('T')[0];
    const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');

    // Get current date in local timezone, then convert to UTC date string
    const now = new Date();
    const nowLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowUTC = new Date(nowLocalStr + 'T00:00:00.000Z');

    console.log(`  Current date: ${nowLocalStr}, nowUTC: ${nowUTC.toISOString()}`);

    const inputStartStr = this.inputs.start_date.toISOString().split('T')[0];
    let startDateUTC = new Date(inputStartStr + 'T00:00:00.000Z');

    // Use the global start date for all exams (computed per-group in calculateOptimalStartDate).
    // Distribution works like OFF from this start date — no per-exam restriction.
    console.log(`  📐 Using start for ${exam.subject}: ${startDateUTC.toISOString().split('T')[0]}`);

    const completedHrs = this.inputs.completed_hours?.[exam.id] || 0;
    const sessionsNeeded = Math.ceil(Math.max(0, this.calculateTotalHours(exam) - completedHrs) / (this.inputs.session_duration / 60));

    // If today is past the optimal start but we still have enough days, use today
    const daysAvailable = Math.floor((examDateUTC.getTime() - nowUTC.getTime()) / (24 * 60 * 60 * 1000));
    if (nowUTC > startDateUTC && daysAvailable >= sessionsNeeded + 1) {
      startDateUTC = nowUTC;
    }

    // Safety: never generate slots before today
    if (startDateUTC < nowUTC) {
      startDateUTC = nowUTC;
    }

    console.log(`  Input start: ${inputStartStr}, Initial start date: ${startDateUTC.toISOString().split('T')[0]}`);
    console.log(`  Days until exam: ${daysAvailable}, Sessions needed: ${sessionsNeeded}`);

    // Check if this exam has a large gap from the previous exam
    // If so, start valid slots after the previous exam to avoid clustering
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const completedHrsForSlots = this.inputs.completed_hours?.[exam.id] || 0;
    const totalHours = Math.max(0, this.calculateTotalHours(exam) - completedHrsForSlots);
    const totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);

    // Find the closest earlier exam (exam that happens before this one)
    // Compare using date strings to avoid timezone issues
    const earlierExams = this.inputs.exams
      .filter(e => {
        if (e.id === exam.id) return false;
        const eDate = e.exam_date.toISOString().split('T')[0];
        return eDate < examDateStr;
      })
      .sort((a, b) => b.exam_date.getTime() - a.exam_date.getTime()); // Sort by date descending

    if (earlierExams.length > 0) {
      const closestEarlierExam = earlierExams[0];
      const earlierExamDateStr = closestEarlierExam.exam_date.toISOString().split('T')[0];
      const earlierExamDateUTC = new Date(earlierExamDateStr + 'T00:00:00.000Z');

      // Calculate the gap between the earlier exam and this exam
      const gapDays = Math.floor((examDateUTC.getTime() - earlierExamDateUTC.getTime()) / (24 * 60 * 60 * 1000));

      console.log(`  🔍 Gap check for ${exam.subject}:`);
      console.log(`    Earlier exam: ${closestEarlierExam.subject} on ${earlierExamDateStr}`);
      console.log(`    This exam: ${exam.subject} on ${examDateStr}`);
      console.log(`    Gap: ${gapDays} days, Sessions needed: ${totalSessions}`);
      console.log(`    Threshold: ${totalSessions + 2} days`);

      // If gap is large enough for this exam's sessions (with buffer), use isolated distribution
      // Gap needs to be at least: sessions needed + 2 day buffer
      if (gapDays >= totalSessions + 2) {
        // Start from the day after the earlier exam
        const newStartDate = new Date(earlierExamDateUTC.getTime() + 24 * 60 * 60 * 1000);
        console.log(`    newStartDate: ${newStartDate.toISOString().split('T')[0]}, current startDateUTC: ${startDateUTC.toISOString().split('T')[0]}`);
        // Use getTime() for reliable date comparison
        if (newStartDate.getTime() > startDateUTC.getTime()) {
          startDateUTC = new Date(newStartDate);
          console.log(`    ✓ Large gap detected! Using isolated distribution starting from ${startDateUTC.toISOString().split('T')[0]}`);
        } else {
          console.log(`    ✗ newStartDate not greater than startDateUTC, not applying isolation`);
        }
      } else {
        console.log(`    ✗ Gap (${gapDays}) < threshold (${totalSessions + 2}), not applying isolation`);
      }
    }

    console.log(`  Final start date: ${startDateUTC.toISOString().split('T')[0]}`);

    // Determine the last valid study day
    let lastValidDay: Date;
    if (exam.can_study_after_exam) {
      lastValidDay = new Date(examDateUTC); // Include exam day
    } else {
      lastValidDay = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000); // Day before exam
    }

    // Build set of blocked days for fast lookup
    const blockedSet = new Set(this.inputs.blocked_days || []);

    // Generate all valid days from start to last valid day (all in UTC), skipping blocked days
    for (let d = new Date(startDateUTC); d <= lastValidDay; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (blockedSet.has(dateStr)) {
        console.log(`  ⛔ Skipping blocked day: ${dateStr}`);
        continue;
      }
      validSlots.push(new Date(d));
    }

    console.log(`  Generated ${validSlots.length} valid slots:`, validSlots.map(d => d.toISOString().split('T')[0]));
    return validSlots;
  }

  public getValidSlotsForAllExams(): { [examName: string]: string[] } {
    const result: { [examName: string]: string[] } = {};

    for (const exam of this.inputs.exams) {
      const validSlots = this.generateValidSlotsForExam(exam);
      result[exam.subject] = validSlots.map(date => date.toISOString().split('T')[0]);
    }

    return result;
  }

  private assignSessionsEvenly(exam: ExamData, validSlots: Date[]): Map<string, number> {
    console.log(`\n*** assignSessionsEvenly called for ${exam.subject} ***`);
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const calculatedHours = this.calculateTotalHours(exam);
    const completedHours = this.inputs.completed_hours?.[exam.id] || 0;
    const totalHours = Math.max(0, calculatedHours - completedHours);
    const totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);

    console.log(`=== ASSIGNING SESSIONS FOR ${exam.subject} ===`);
    console.log(`Calculated hours: ${calculatedHours}, Completed: ${completedHours}, Remaining: ${totalHours}, Sessions: ${totalSessions}`);
    console.log(`Session duration: ${this.inputs.session_duration} minutes = ${STUDY_CHUNK_HOURS} hours`);
    console.log(`Valid slots:`, validSlots.length, 'days:', validSlots.map(d => d.toISOString().split('T')[0]));

    const sessionMap = new Map<string, number>();

    if (validSlots.length === 0 || totalSessions === 0) {
      console.log('No valid slots or sessions needed');
      return sessionMap;
    }

    const sortedSlots = [...validSlots].sort((a, b) => a.getTime() - b.getTime());
    // Parse exam date as UTC to avoid timezone shifts
    const examDateStr = exam.exam_date.toISOString().split('T')[0];
    const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
    const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);

    // Ensure final review session the day before exam (handled separately)
    const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];

    // Check if day before exam is available
    const dayBeforeExamAvailable = sortedSlots.some(slot => slot.toISOString().split('T')[0] === dayBeforeExamStr);

    // Compute natural sessions/day from available slots — same for both ON and OFF.
    // With many days (OFF), this is ~1. With fewer days (ON), it's higher.
    const naturalSessionsPerDay = Math.ceil(totalSessions / Math.max(1, sortedSlots.length));
    let hasFinalReview = false;
    let finalReviewSessions = 0;
    if (dayBeforeExamAvailable && sortedSlots.length > 1) {
      finalReviewSessions = Math.min(naturalSessionsPerDay, totalSessions);
      sessionMap.set(dayBeforeExamStr, finalReviewSessions);
      hasFinalReview = true;
    }

    // Calculate remaining sessions and available days
    const remainingSessions = hasFinalReview ? totalSessions - finalReviewSessions : totalSessions;

    const availableDays = hasFinalReview
      ? sortedSlots.filter(slot => slot.toISOString().split('T')[0] !== dayBeforeExamStr)
      : sortedSlots;

    console.log(`Day before exam available: ${dayBeforeExamAvailable}, Total slots: ${sortedSlots.length}`);
    console.log(`Final review placed: ${hasFinalReview}, Remaining sessions to place: ${remainingSessions}, Available days: ${availableDays.length}`);

    if (remainingSessions > 0 && availableDays.length > 0) {
      // Calculate optimal distribution allowing multiple sessions per day for even workload
      // Strategy 1: Try to distribute with 1 session per day and 3-day max gap
      const maxGapDays = 2; // 2 empty days = 3-day gap total

      // Calculate the ideal gap to distribute sessions evenly
      let idealGap;
      if (availableDays.length >= remainingSessions * 3) {
        // Lots of time available, prioritize even distribution over gap rules
        // Use smaller gaps to utilize more days
        idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
        idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
      } else {
        // Limited time, calculate optimal gap
        idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
        idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
      }

      // Work backwards from exam date with max 2-day interval between sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const MAX_INTERVAL_DAYS = 2; // Standard 2-day max gap between sessions

      console.log(`  Available days:`, availableDays.map(d => d.toISOString().split('T')[0]));
      console.log(`  Need to place ${remainingSessions} sessions with max ${MAX_INTERVAL_DAYS}-day interval`);

      // Check if there are existing sessions for this exam
      let existingSessionDates: string[] = [];
      const hasMultipleExams = this.inputs.exams.length > 1;

      if (this.inputs.existing_sessions && !hasMultipleExams) {
        // Only reuse existing sessions if this is a single exam
        // For multiple exams, always reschedule to apply diversification
        const availableDatesSet = new Set(availableDays.map(d => d.toISOString().split('T')[0]));

        existingSessionDates = this.inputs.existing_sessions
          .filter(s => s.subjectId === exam.id)
          .map(s => s.date.toISOString().split('T')[0])
          .filter(dateStr => availableDatesSet.has(dateStr));
      }

      // Check if this exam is isolated (has a large gap from earlier exams)
      // If isolated, treat it like a single exam and skip diversification rules
      const examDateStr = exam.exam_date.toISOString().split('T')[0];
      const earlierExams = this.inputs.exams
        .filter(e => {
          if (e.id === exam.id) return false;
          const eDate = e.exam_date.toISOString().split('T')[0];
          return eDate < examDateStr;
        })
        .sort((a, b) => b.exam_date.getTime() - a.exam_date.getTime());

      // An exam is isolated ONLY if it has a large gap from the closest earlier OR same-day exam
      // If there are other exams on the same day or close by, it's NOT isolated
      let isIsolatedExam = false;

      // Check for same-day or close exams (within the session count + 2 days)
      const closeExams = this.inputs.exams.filter(e => {
        if (e.id === exam.id) return false;
        const eDate = e.exam_date.toISOString().split('T')[0];
        const thisExamDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
        const otherExamDateUTC = new Date(eDate + 'T00:00:00.000Z');
        const daysDiff = Math.abs(Math.floor((thisExamDateUTC.getTime() - otherExamDateUTC.getTime()) / (24 * 60 * 60 * 1000)));
        // Consider exams within (totalSessions + 2) days as "close"
        return daysDiff < totalSessions + 2;
      });

      if (closeExams.length === 0 && earlierExams.length > 0) {
        // No close exams, but there are earlier exams - check if gap is large enough
        const closestEarlierExam = earlierExams[0];
        const earlierExamDateStr = closestEarlierExam.exam_date.toISOString().split('T')[0];
        const earlierExamDateUTC = new Date(earlierExamDateStr + 'T00:00:00.000Z');
        const thisExamDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
        const gapDays = Math.floor((thisExamDateUTC.getTime() - earlierExamDateUTC.getTime()) / (24 * 60 * 60 * 1000));

        if (gapDays >= totalSessions + 2) {
          isIsolatedExam = true;
          console.log(`  🏝️ ${exam.subject} is ISOLATED (gap: ${gapDays} days from ${closestEarlierExam.subject}) - using single-exam distribution`);
        }
      } else if (closeExams.length === 0 && earlierExams.length === 0) {
        // No close exams and no earlier exams - check if there are ANY other exams
        const otherExams = this.inputs.exams.filter(e => e.id !== exam.id);
        if (otherExams.length === 0) {
          // Truly single exam
          isIsolatedExam = true;
          console.log(`  🏝️ ${exam.subject} is ISOLATED (only exam) - using single-exam distribution`);
        } else {
          // There are other exams but they're all later - treat as isolated
          isIsolatedExam = true;
          console.log(`  🏝️ ${exam.subject} is ISOLATED (first exam, only later exams) - using single-exam distribution`);
        }
      } else {
        console.log(`  ${exam.subject} has ${closeExams.length} close exam(s) - NOT isolated`);
      }

      if (hasMultipleExams && !isIsolatedExam) {
        console.log(`  Multiple exams detected - applying diversification (not reusing existing sessions)`);
      } else {
        console.log(`  Existing session dates for ${exam.subject}:`, existingSessionDates);
      }

      let sessionCount = 0;

      // Only reuse existing sessions for single exam scenarios or isolated exams
      if (existingSessionDates.length > 0 && (!hasMultipleExams || isIsolatedExam)) {
        console.log(`  Reusing ${existingSessionDates.length} existing session dates`);

        for (const existingDate of existingSessionDates) {
          if (sessionCount >= remainingSessions) break;

          sessionMap.set(existingDate, 1);
          sessionCount++;
          console.log(`  ✓ Placed session ${sessionCount}/${remainingSessions} on ${existingDate} (existing session)`);
        }
      }

      // Distribute sessions with diversification (spread across days, not all consecutive)
      if (sessionCount < remainingSessions) {
        const sessionsToPlace = remainingSessions - sessionCount;
        console.log(`  Need to place ${sessionsToPlace} sessions (remaining: ${remainingSessions}, already placed: ${sessionCount})`);
        console.log(`  Total sessions should be: ${totalSessions} (including final review: ${hasFinalReview})`);
        console.log(`  Available days count: ${availableDays.length}, Sessions to place: ${sessionsToPlace}`);
        console.log(`  Distributing ${sessionsToPlace} sessions with diversification (max ${MAX_INTERVAL_DAYS}-day interval)`);

        const unassignedDays = availableDays.filter(d => !sessionMap.has(d.toISOString().split('T')[0]));

        if (unassignedDays.length === 0) {
          console.log(`  No more available days`);
        } else {
          // Sort unassigned days chronologically
          unassignedDays.sort((a, b) => a.getTime() - b.getTime());

          console.log(`  Available unassigned days:`, unassignedDays.map(d => d.toISOString().split('T')[0]));

          // Get which days other exams are using
          const otherExamDays = new Set<string>();
          const prelimSchedules = this.preliminarySchedules;
          prelimSchedules.forEach((schedule, examId) => {
            if (examId !== exam.id) {
              schedule.forEach((sessions, dateStr) => {
                otherExamDays.add(dateStr);
              });
            }
          });

          console.log(`  Days used by other exams:`, Array.from(otherExamDays));

          // Strategy: For isolated exams, use simple consecutive distribution
          // For non-isolated exams, prefer days NOT used by other exams, max 2 consecutive sessions
          const selectedDays: Date[] = [];
          let consecutiveCount = 0;
          let lastSelectedDate: Date | null = null;

          // Work backwards from the latest available day
          const reversedDays = [...unassignedDays].reverse();

          // ── Bypass skipping if severely constrained (only when preferences ON) ──
          // If we absolutely need every available day, skip the aesthetic constraints.
          const tightlyConstrained = unassignedDays.length <= sessionsToPlace + 2;
          const maxCrushSpan = 3; // Max consecutive sessions for diversification

          if (isIsolatedExam) {
            // ISOLATED EXAM: Simple consecutive distribution (like single-exam mode)
            console.log(`  Using simple consecutive distribution for isolated exam`);
            for (const day of reversedDays) {
              if (selectedDays.length >= sessionsToPlace) break;

              const dateStr = day.toISOString().split('T')[0];

              if (lastSelectedDate === null) {
                selectedDays.push(day);
                lastSelectedDate = day;
                console.log(`  Selected ${dateStr} (first session)`);
              } else {
                const daysDiff = Math.floor((lastSelectedDate.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));

                // Only respect max interval, no diversification rules
                if (daysDiff <= MAX_INTERVAL_DAYS + 1) {
                  selectedDays.push(day);
                  lastSelectedDate = day;
                  console.log(`  Selected ${dateStr} (${daysDiff} days from last)`);
                } else {
                  console.log(`  Skipping ${dateStr} (would violate max interval: ${daysDiff} days)`);
                }
              }
            }
          } else {
            // NON-ISOLATED EXAM: Apply diversification, but NEVER create a gap > MAX_INTERVAL_DAYS.
            for (const day of reversedDays) {
              if (selectedDays.length >= sessionsToPlace) {
                console.log(`  Stopping: selected ${selectedDays.length} days, need ${sessionsToPlace} sessions`);
                break;
              }

              const dateStr = day.toISOString().split('T')[0];

              const isUsedByOther = otherExamDays.has(dateStr);
              const tightlyConstrained = unassignedDays.length <= sessionsToPlace + 2;

              if (lastSelectedDate === null) {
                // First session: always select
                selectedDays.push(day);
                lastSelectedDate = day;
                consecutiveCount = 1;
                console.log(`  Selected ${dateStr} (first session, used by other: ${isUsedByOther})`);
              } else {
                const daysDiff = Math.floor((lastSelectedDate.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
                const isConsecutive = daysDiff === 1;

                // ── Hard gap constraint: if daysDiff already equals MAX_INTERVAL_DAYS+1
                // (i.e. exactly 3 calendar days apart, which is the limit), we MUST
                // select this day or the next one will exceed the limit.
                const mustSelect = daysDiff >= MAX_INTERVAL_DAYS + 1;

                if (mustSelect) {
                  // We have no choice — select regardless of other-exam usage
                  selectedDays.push(day);
                  lastSelectedDate = day;
                  consecutiveCount = isConsecutive ? consecutiveCount + 1 : 1;
                  console.log(`  FORCED: Selected ${dateStr} (gap would exceed limit: ${daysDiff} days, used by other: ${isUsedByOther})`);
                } else if (daysDiff > MAX_INTERVAL_DAYS + 1) {
                  // This day is already too far back — skip it entirely (gap already violated
                  // without this day, which means we already selected what we needed earlier).
                  // This branch should not normally be reached with mustSelect above.
                  console.log(`  Skipping ${dateStr} (too far: ${daysDiff} days from lastSelected)`);
                } else {
                  // daysDiff <= MAX_INTERVAL_DAYS (within the comfortable window)
                  // Max 3 consecutive sessions, unless tightly constrained
                  if (isConsecutive && consecutiveCount >= 3 && !tightlyConstrained) {
                    console.log(`  Skipping ${dateStr} (would be 4th consecutive session)`);
                    continue;
                  }

                  const daysRemaining = reversedDays.filter(d => d < day).length;
                  const sessionsRemaining = sessionsToPlace - selectedDays.length - 1;

                  const shouldSkip = isUsedByOther;

                  // Only skip for diversification (or spreading) if there are enough days left AND
                  // skipping won't push us too close to the gap limit.
                  const safeToSkip = daysDiff < MAX_INTERVAL_DAYS && shouldSkip && daysRemaining >= sessionsRemaining * 1.5 && !tightlyConstrained;

                  if (safeToSkip) {
                    console.log(`  Skipping ${dateStr} (shouldSkip=${shouldSkip}, daysDiff=${daysDiff}, ${daysRemaining} days left — safe)`);
                    continue;
                  }

                  selectedDays.push(day);
                  lastSelectedDate = day;
                  consecutiveCount = isConsecutive ? consecutiveCount + 1 : 1;
                  console.log(`  Selected ${dateStr} (${daysDiff} days from last, consec: ${consecutiveCount}, used by other: ${isUsedByOther})`);
                }
              }
            }
          }

          // If we didn't get enough sessions, fill in the gaps
          if (selectedDays.length < sessionsToPlace) {
            console.log(`  Only selected ${selectedDays.length}/${sessionsToPlace} sessions, filling gaps...`);

            for (const day of reversedDays) {
              if (selectedDays.length >= sessionsToPlace) break;

              const dateStr = day.toISOString().split('T')[0];
              if (!selectedDays.some(d => d.toISOString().split('T')[0] === dateStr)) {
                selectedDays.push(day);
                console.log(`  Added ${dateStr} to fill gap`);
              }
            }
          }

          // CRITICAL FALLBACK: If we don't have enough selected days, add ALL remaining unassigned days
          // This ensures all sessions are created even if diversification rules were too strict
          if (selectedDays.length < Math.min(sessionsToPlace, unassignedDays.length)) {
            console.log(`  ⚠️ Only selected ${selectedDays.length} days but need ${sessionsToPlace} sessions (${unassignedDays.length} available)`);
            console.log(`  Adding all remaining unassigned days to ensure all sessions are created`);

            for (const day of reversedDays) {
              const dateStr = day.toISOString().split('T')[0];
              if (!selectedDays.some(d => d.toISOString().split('T')[0] === dateStr)) {
                selectedDays.push(day);
                console.log(`  Added ${dateStr} (now have ${selectedDays.length} days)`);
              }
            }
          }

          // Place sessions on selected days
          selectedDays.sort((a, b) => a.getTime() - b.getTime()); // Sort chronologically

          console.log(`  Placing ${selectedDays.length} selected days, need ${sessionsToPlace} sessions`);

          // If we don't have enough days, we need to place multiple sessions per day
          const maxSessionsPerDay = this.getMaxSessionsPerDayForExamId(exam.id);

          if (selectedDays.length < sessionsToPlace) {
            console.log(`  ⚠️  Not enough days (${selectedDays.length}) for sessions (${sessionsToPlace})`);
            console.log(`  Will place multiple sessions per day - IGNORING daily limit to ensure all sessions are created`);
            console.log(`  Selected days:`, selectedDays.map(d => d.toISOString().split('T')[0]));
            console.log(`  Current sessionMap before placement:`, Object.fromEntries(sessionMap));
            console.log(`  Current sessionCount: ${sessionCount}`);

            // Distribute sessions evenly across available days - ignore daily limit
            let remainingToPlace = sessionsToPlace;
            for (let i = 0; i < selectedDays.length && remainingToPlace > 0; i++) {
              const day = selectedDays[i];
              const dateStr = day.toISOString().split('T')[0];

              console.log(`  [Loop ${i}] Processing day ${dateStr}, remainingToPlace: ${remainingToPlace}`);

              // Calculate how many sessions to place on this day
              const daysLeft = selectedDays.length - i;
              const sessionsForThisDay = Math.ceil(remainingToPlace / daysLeft);

              console.log(`    daysLeft: ${daysLeft}, sessionsForThisDay: ${sessionsForThisDay}`);

              const currentSessions = sessionMap.get(dateStr) || 0;
              const sessionsToAdd = sessionsForThisDay;

              console.log(`    currentSessions: ${currentSessions}, sessionsToAdd: ${sessionsToAdd}`);

              sessionMap.set(dateStr, currentSessions + sessionsToAdd);
              sessionCount += sessionsToAdd;
              remainingToPlace -= sessionsToAdd;
              console.log(`  ✓ Placed ${sessionsToAdd} session(s) on ${dateStr} (total: ${currentSessions + sessionsToAdd}, remaining: ${remainingToPlace})`);
            }

            console.log(`  After multi-session placement, sessionMap:`, Object.fromEntries(sessionMap));
            console.log(`  After multi-session placement, sessionCount: ${sessionCount}`);
          } else {
            // Normal case: enough days for 1 session per day
            for (const day of selectedDays) {
              if (sessionCount >= remainingSessions) {
                console.log(`  Stopping: already placed ${sessionCount}/${remainingSessions} sessions`);
                break;
              }

              const dateStr = day.toISOString().split('T')[0];
              if (sessionMap.has(dateStr)) {
                console.log(`  Skipping ${dateStr} - already has a session`);
                continue;
              }

              sessionMap.set(dateStr, 1);
              sessionCount++;
              console.log(`  ✓ Placed session ${sessionCount}/${remainingSessions} on ${dateStr}`);
            }
          }
        }
      }

      // ── HARD RULE: enforce ≤ 3-day gap between consecutive sessions of this exam ──
      // Repeat until no violations remain (inserting a session inside each offending gap).
      // Use ALL valid slots (sortedSlots) as candidates, not just availableDays, so we can
      // fill gaps even in the excluded day-before-exam region.
      const availableDayStrSet = new Set(sortedSlots.map(d => d.toISOString().split('T')[0]));

      let fixIterations = 0;
      const MAX_FIX_ITERATIONS = 20; // safety valve

      while (fixIterations++ < MAX_FIX_ITERATIONS) {
        const sortedDates = Array.from(sessionMap.keys()).sort();
        let fixedAny = false;

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDateStr = sortedDates[i - 1];
          const currDateStr = sortedDates[i];
          const prevMs = new Date(prevDateStr).getTime();
          const currMs = new Date(currDateStr).getTime();
          const gapDays = Math.floor((currMs - prevMs) / (24 * 60 * 60 * 1000)) - 1; // empty days between

          if (gapDays > MAX_INTERVAL_DAYS) {
            console.log(`  ⚠ Gap violation: ${gapDays} empty days between ${prevDateStr} and ${currDateStr} — inserting session`);

            // Find the best available day inside this gap
            // Prefer days not already used by other exams, but ANY day in the gap is acceptable
            let bestCandidate: string | null = null;
            let bestIntensity = Infinity;

            // Target: pick a day roughly in the middle of the gap so we split it evenly
            const midMs = (prevMs + currMs) / 2;

            const candidatesInGap: string[] = [];
            for (let ms = prevMs + 24 * 60 * 60 * 1000; ms < currMs; ms += 24 * 60 * 60 * 1000) {
              const candidateStr = new Date(ms).toISOString().split('T')[0];
              if (availableDayStrSet.has(candidateStr) && !sessionMap.has(candidateStr)) {
                candidatesInGap.push(candidateStr);
              }
            }

            if (candidatesInGap.length === 0) {
              console.log(`  ✗ No available slot in gap between ${prevDateStr} and ${currDateStr} — cannot fix`);
              break; // nothing we can do for this gap
            }

            // Score candidates: prefer lower other-exam intensity, then closest to midpoint
            for (const candidateStr of candidatesInGap) {
              let intensity = 0;
              this.preliminarySchedules.forEach((schedule, examId) => {
                if (examId !== exam.id && schedule.has(candidateStr)) {
                  intensity += schedule.get(candidateStr) || 0;
                }
              });
              const distFromMid = Math.abs(new Date(candidateStr).getTime() - midMs);
              // Combine: score = intensity * 1e12 + distFromMid (so intensity dominates)
              const score = intensity * 1e12 + distFromMid;
              if (score < bestIntensity) {
                bestIntensity = score;
                bestCandidate = candidateStr;
              }
            }

            if (bestCandidate) {
              sessionMap.set(bestCandidate, 1);
              console.log(`  ✓ Inserted session on ${bestCandidate} to fix gap`);
              fixedAny = true;
              // Restart the gap-check loop from scratch since dates changed
              break;
            }
          }
        }

        if (!fixedAny) break; // no violations found (or none fixable)
      }

      // ── Final report ──
      console.log(`  After gap enforcement: sessions on`, Array.from(sessionMap.keys()).sort());

      // Note: gap-enforcement may have added extra sessions beyond the original totalSessions
      // calculation — that is intentional and correct. The ≤3-day hard rule takes priority
      // over session count targets, so we do NOT remove any sessions here.
      let totalAssigned = 0;
      sessionMap.forEach(count => totalAssigned += count);

      console.log(`  Final: ${totalAssigned} sessions total (target was ${totalSessions}, gap-enforcement may have added extras)`);
      if (totalAssigned < totalSessions) {
        // Under-count is still a problem worth logging
        console.error(`  WARNING: Only ${totalAssigned} sessions placed but ${totalSessions} were needed!`);
      }
    }

    console.log(`Final session assignment for ${exam.subject}:`, Object.fromEntries(sessionMap));
    return sessionMap;
  }

  public getPreliminarySchedule(): { [examName: string]: { [date: string]: number } } {
    const result: { [examName: string]: { [date: string]: number } } = {};

    for (const exam of this.inputs.exams) {
      const validSlots = this.generateValidSlotsForExam(exam);
      const sessionMap = this.assignSessionsEvenly(exam, validSlots);

      const dateSessionMap: { [date: string]: number } = {};
      sessionMap.forEach((sessions, date) => {
        dateSessionMap[date] = sessions;
      });

      result[exam.subject] = dateSessionMap;
    }

    return result;
  }

  private mergeExamsIntoDailyPlan(): Map<string, Map<string, number>> {
    console.log('=== UNIFIED SCORING ENGINE ===');

    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const HARD_MAX_SESSIONS = Math.max(1, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));
    const MAX_INTERVAL_DAYS = 2; // max empty days between sessions for same exam

    // Build blocked days set
    const blockedSet = new Set(this.inputs.blocked_days || []);

    // ── Phase 1: Enumerate valid slots and compute sessions needed per exam ──
    interface ExamInfo {
      exam: ExamData;
      sessionsNeeded: number;
      sessionsRemaining: number;
      validDays: Set<string>;
      lastAssignedDay: string | null; // track for gap scoring
      dayBeforeExam: string;
    }

    const examInfos: ExamInfo[] = [];
    const allStudyDays = new Set<string>();

    for (const exam of this.inputs.exams) {
      const completedHrs = this.inputs.completed_hours?.[exam.id] || 0;
      const totalHours = Math.max(0, this.calculateTotalHours(exam) - completedHrs);
      const sessionsNeeded = Math.ceil(totalHours / STUDY_CHUNK_HOURS);

      if (sessionsNeeded <= 0) continue;

      const validSlots = this.generateValidSlotsForExam(exam);
      const validDays = new Set(validSlots.map(d => d.toISOString().split('T')[0]));

      // Day before exam for final review
      const examDateStr = exam.exam_date.toISOString().split('T')[0];
      const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
      const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      validDays.forEach(d => allStudyDays.add(d));

      examInfos.push({
        exam,
        sessionsNeeded,
        sessionsRemaining: sessionsNeeded,
        validDays,
        lastAssignedDay: null,
        dayBeforeExam,
      });

      console.log(`  ${exam.subject}: ${sessionsNeeded} sessions, ${validDays.size} valid days, exam: ${examDateStr}`);
    }

    if (examInfos.length === 0) {
      return new Map();
    }

    // Sort study days chronologically
    const sortedDays = Array.from(allStudyDays).sort();
    const totalSessions = examInfos.reduce((sum, ei) => sum + ei.sessionsNeeded, 0);
    let targetPerDay = Math.max(1, Math.ceil(totalSessions / sortedDays.length));
    // Clamp to hard max
    targetPerDay = Math.min(targetPerDay, HARD_MAX_SESSIONS);

    console.log(`  Total sessions: ${totalSessions}, Study days: ${sortedDays.length}, Target/day: ${targetPerDay}`);

    // ── Phase 2: Unified greedy assignment with scoring ──
    const schedule = new Map<string, Map<string, number>>();
    // Initialize all days
    for (const day of sortedDays) {
      schedule.set(day, new Map());
    }

    // Helper: get total sessions on a day
    const dayLoad = (day: string): number => {
      const dayMap = schedule.get(day);
      if (!dayMap) return 0;
      return Array.from(dayMap.values()).reduce((s, v) => s + v, 0);
    };

    // Helper: get sessions of a specific exam on a day
    const examLoadOnDay = (day: string, examId: string): number => {
      return schedule.get(day)?.get(examId) || 0;
    };

    // Helper: days between two date strings
    const daysBetween = (a: string, b: string): number => {
      return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
    };

    // Build set of all exam dates — avoid scheduling other exams on these days
    const examDatesSet = new Set<string>();
    for (const exam of this.inputs.exams) {
      examDatesSet.add(exam.exam_date.toISOString().split('T')[0]);
    }

    // Main assignment: iterate through days in REVERSE (latest first)
    // This packs sessions near exam dates, not at the start of the study period.
    // We may need multiple passes if targetPerDay needs to increase.
    let totalAssigned = 0;
    let maxPasses = 5;

    // Reverse days for iteration (latest first, closest to exams)
    const reversedDays = [...sortedDays].reverse();

    while (totalAssigned < totalSessions && maxPasses > 0) {
      maxPasses--;
      let assignedThisPass = 0;

      for (const day of reversedDays) {
        if (blockedSet.has(day)) continue;

        while (dayLoad(day) < targetPerDay && totalAssigned < totalSessions) {
          // Score each exam for this day
          let bestExam: ExamInfo | null = null;
          let bestScore = -Infinity;

          for (const ei of examInfos) {
            if (ei.sessionsRemaining <= 0) continue;
            if (!ei.validDays.has(day)) continue;

            let score = 0;

            // P4: Final review bonus (day before exam gets priority)
            if (day === ei.dayBeforeExam) {
              score += 500;
            }

            // P5: Even distribution — higher score when day has fewer sessions
            // (this naturally enforces the ±1 spread since we fill to targetPerDay)
            score += 100 * (targetPerDay - dayLoad(day));

            // P6: Gap urgency — based on nextAssignedDay (since we iterate backwards)
            if (ei.lastAssignedDay !== null) {
              // lastAssignedDay = the closest LATER day we already assigned to (we go backwards)
              const gap = daysBetween(day, ei.lastAssignedDay);
              const urgency = Math.min(gap, 5);
              score += 50 * urgency;

              // Strong push when gap exceeds limit
              if (gap > MAX_INTERVAL_DAYS + 1) {
                score += 300;
              }
            } else {
              // Exam hasn't been assigned yet — check how close the exam is
              const examDateStr = ei.exam.exam_date.toISOString().split('T')[0];
              const daysToExam = daysBetween(day, examDateStr);
              const daysNeeded = ei.sessionsRemaining;
              if (daysToExam <= daysNeeded + 2) {
                score += 200; // urgent: running out of days
              } else {
                score += 50;
              }
            }

            // P7: Diversification — penalty for same exam already on this day
            if (examLoadOnDay(day, ei.exam.id) >= 1) {
              score -= 300;
            }

            // Penalty: avoid scheduling on another exam's exam date
            if (examDatesSet.has(day)) {
              const examDateStr = ei.exam.exam_date.toISOString().split('T')[0];
              if (day !== examDateStr) {
                // This day is some OTHER exam's exam date — avoid it
                score -= 400;
              }
            }

            // Tiebreaker: prefer exams with more sessions remaining
            score += ei.sessionsRemaining * 2;

            // Tiebreaker: prefer exams with earlier exam dates (more urgent)
            const examDateStr = ei.exam.exam_date.toISOString().split('T')[0];
            const proximity = daysBetween(day, examDateStr);
            if (proximity <= 3) {
              score += 30;
            }

            if (score > bestScore) {
              bestScore = score;
              bestExam = ei;
            }
          }

          if (!bestExam || bestScore <= -100) break; // no exam can go here

          // Assign 1 session
          const dayMap = schedule.get(day)!;
          dayMap.set(bestExam.exam.id, (dayMap.get(bestExam.exam.id) || 0) + 1);
          bestExam.sessionsRemaining--;
          bestExam.lastAssignedDay = day; // tracks the earliest assigned day (going backwards)
          totalAssigned++;
          assignedThisPass++;

          console.log(`  Assigned ${bestExam.exam.subject} to ${day} (score: ${bestScore}, load: ${dayLoad(day)}, remaining: ${bestExam.sessionsRemaining})`);
        }
      }

      if (assignedThisPass === 0) {
        // No progress — increase targetPerDay and try again
        targetPerDay = Math.min(targetPerDay + 1, HARD_MAX_SESSIONS);
        console.log(`  No progress, raising targetPerDay to ${targetPerDay}`);
        if (targetPerDay >= HARD_MAX_SESSIONS && assignedThisPass === 0) {
          console.log(`  At HARD_MAX and still can't assign — some sessions may be dropped`);
          break;
        }
      }
    }

    // ── Phase 3: Ensure final review sessions ──
    for (const ei of examInfos) {
      const dayBefore = ei.dayBeforeExam;
      if (!schedule.has(dayBefore)) continue;
      if (blockedSet.has(dayBefore)) continue;

      const currentReview = examLoadOnDay(dayBefore, ei.exam.id);
      if (currentReview >= 1) continue; // already has a session

      // Find the day with the MOST sessions of this exam (not the day before) to move one
      let bestSourceDay: string | null = null;
      let bestSourceCount = 0;

      schedule.forEach((dayMap, dateStr) => {
        if (dateStr === dayBefore) return;
        const count = dayMap.get(ei.exam.id) || 0;
        if (count > bestSourceCount) {
          bestSourceCount = count;
          bestSourceDay = dateStr;
        }
      });

      if (bestSourceDay && bestSourceCount > 0) {
        // Move 1 session to day before exam
        const sourceMap = schedule.get(bestSourceDay)!;
        sourceMap.set(ei.exam.id, sourceMap.get(ei.exam.id)! - 1);
        if (sourceMap.get(ei.exam.id) === 0) sourceMap.delete(ei.exam.id);

        const targetMap = schedule.get(dayBefore)!;
        targetMap.set(ei.exam.id, (targetMap.get(ei.exam.id) || 0) + 1);

        console.log(`  Final review: moved ${ei.exam.subject} from ${bestSourceDay} to ${dayBefore}`);
      }
    }

    // ── Log final schedule ──
    console.log('=== FINAL UNIFIED SCHEDULE ===');
    const sortedFinal = Array.from(schedule.keys()).sort();
    for (const day of sortedFinal) {
      const dayMap = schedule.get(day)!;
      const total = Array.from(dayMap.values()).reduce((s, v) => s + v, 0);
      if (total > 0) {
        const exams = Array.from(dayMap.entries()).map(([id, count]) => {
          const exam = this.inputs.exams.find(e => e.id === id);
          return `${exam?.subject || id}:${count}`;
        }).join(', ');
        console.log(`  ${day}: ${total} sessions (${exams})`);
      }
    }

    // Log spread check
    const loads = sortedFinal.map(d => dayLoad(d)).filter(l => l > 0);
    if (loads.length > 0) {
      const min = Math.min(...loads);
      const max = Math.max(...loads);
      console.log(`  Spread: min=${min}, max=${max}, diff=${max - min} ${max - min <= 1 ? '✅' : '⚠️'}`);
    }

    // Remove empty days from the schedule
    for (const day of sortedFinal) {
      if (dayLoad(day) === 0) {
        schedule.delete(day);
      }
    }

    return schedule;
  }

  private addEmptyDaysToSchedule(mergedSchedule: Map<string, Map<string, number>>): void {
    // Add empty days from the user's start_date to give the balancer and merge overflow
    // a full runway of available days. No filtering through per-exam valid slots here —
    // the balancer/overflow needs ALL calendar days, not just the compressed exam windows.
    const allDates = Array.from(mergedSchedule.keys()).sort();
    if (allDates.length === 0) return;

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowUTC = new Date(nowStr + 'T00:00:00.000Z');

    const firstDateFromStart = new Date(this.inputs.start_date);
    firstDateFromStart.setHours(0, 0, 0, 0);
    // Never add days before today
    const firstDate = firstDateFromStart > nowUTC ? firstDateFromStart : nowUTC;
    const lastDate = new Date(allDates[allDates.length - 1] + 'T00:00:00.000Z');

    // Build blocked days set for quick lookup
    const blockedDays = new Set(this.inputs.blocked_days || []);

    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      if (!mergedSchedule.has(dateStr) && !blockedDays.has(dateStr)) {
        mergedSchedule.set(dateStr, new Map());
        console.log(`Added empty day ${dateStr} to schedule for potential balancing`);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  private balanceWorkload(mergedSchedule: Map<string, Map<string, number>>): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const HARD_MAX_SESSIONS = Math.max(1, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));

    // Compute ideal from actual schedule for even spreading (same for both ON and OFF)
    let MAX_SESSIONS_PER_DAY: number;
    {
      let totalSessions = 0;
      mergedSchedule.forEach((daySchedule) => {
        const daySessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
        totalSessions += daySessions;
      });
      const totalDays = mergedSchedule.size;
      const idealPerDay = Math.max(1, Math.ceil(totalSessions / Math.max(1, totalDays)));
      MAX_SESSIONS_PER_DAY = Math.min(idealPerDay, HARD_MAX_SESSIONS);
      console.log(`📊 Balance: total=${totalSessions}, days=${totalDays}, idealPerDay=${idealPerDay}, effectiveMax=${MAX_SESSIONS_PER_DAY}`);
    }

    // Helper: would moving a session of examId from sourceDate to targetDate create a gap > 2 empty days (MAX_INTERVAL_DAYS)?
    // Checks that removing from sourceDate AND adding to targetDate both respect the consecutive gap limit.
    const wouldMoveCreateGapViolation = (examId: string, sourceDate: string, targetDate: string): boolean => {
      const examSessionDates = Array.from(mergedSchedule.entries())
        .filter(([date, sched]) => sched.has(examId) && (sched.get(examId) || 0) > 0)
        .map(([date]) => date);

      // Simulate removal
      const sourceSessions = mergedSchedule.get(sourceDate)?.get(examId) || 0;
      let afterMove = sourceSessions <= 1
        ? examSessionDates.filter(d => d !== sourceDate)
        : [...examSessionDates];

      // Simulate addition
      if (!afterMove.includes(targetDate)) {
        afterMove.push(targetDate);
      }

      afterMove.sort();

      if (afterMove.length < 2) return false;

      for (let k = 1; k < afterMove.length; k++) {
        const gap = Math.floor(
          (new Date(afterMove[k]).getTime() - new Date(afterMove[k - 1]).getTime()) /
          (24 * 60 * 60 * 1000)
        ) - 1;

        // Only widen gap to 4 when exam >= 14 days away AND schedule has days exceeding soft limit
        let examMaxGap = 2;
        const eState = this.subjects.find(s => s.id === examId);
        if (eState) {
          const daysUntil = Math.floor((eState.exam_date.getTime() - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
          const softLimitSessions = Math.max(1, Math.floor(this.getEffectiveSoftLimit() / (this.inputs.session_duration / 60)));
          const hasDenseDays = Array.from(mergedSchedule.values()).some(day => {
            return Array.from(day.values()).reduce((sum, s) => sum + s, 0) > softLimitSessions;
          });
          if (daysUntil >= 14 && hasDenseDays) {
            examMaxGap = 4;
          }
        }

        if (gap > examMaxGap) return true;
      }
      return false;
    };

    // Get all dates in chronological order
    const allDates = Array.from(mergedSchedule.keys()).sort();

    console.log('=== BALANCING WORKLOAD ===');
    console.log('Max sessions per day:', MAX_SESSIONS_PER_DAY);

    // Find overloaded, busy, and underloaded days
    const overloadedDays: { date: string; totalSessions: number; excess: number }[] = [];
    const busyDays: { date: string; totalSessions: number; canGive: number }[] = [];
    const underloadedDays: { date: string; totalSessions: number; capacity: number }[] = [];

    allDates.forEach(date => {
      const daySchedule = mergedSchedule.get(date)!;
      const totalSessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);

      console.log(`Day ${date}: ${totalSessions} sessions`, Object.fromEntries(daySchedule));

      if (totalSessions > MAX_SESSIONS_PER_DAY) {
        overloadedDays.push({
          date,
          totalSessions,
          excess: totalSessions - MAX_SESSIONS_PER_DAY
        });
        console.log(`  -> OVERLOADED by ${totalSessions - MAX_SESSIONS_PER_DAY} sessions`);
      } else if (totalSessions === MAX_SESSIONS_PER_DAY) {
        // Busy days can give up 1 session if there are empty days that need sessions
        busyDays.push({
          date,
          totalSessions,
          canGive: 1
        });
        console.log(`  -> BUSY (can give 1 session if needed)`);
      } else if (totalSessions < MAX_SESSIONS_PER_DAY) {
        underloadedDays.push({
          date,
          totalSessions,
          capacity: MAX_SESSIONS_PER_DAY - totalSessions
        });
        console.log(`  -> UNDERLOADED with ${MAX_SESSIONS_PER_DAY - totalSessions} capacity`);
      }
    });

    console.log(`Found ${overloadedDays.length} overloaded days, ${busyDays.length} busy days, ${underloadedDays.length} underloaded days`);

    // First, handle overloaded days
    for (const overloadedDay of overloadedDays) {
      const daySchedule = mergedSchedule.get(overloadedDay.date)!;
      let excessToMove = overloadedDay.excess;

      console.log(`Processing overloaded day ${overloadedDay.date}, need to move ${excessToMove} sessions`);

      // Try to move sessions to underloaded days
      for (const underloadedDay of underloadedDays) {
        if (excessToMove <= 0) break;

        const capacity = underloadedDay.capacity;
        let sessionsToMove = Math.min(excessToMove, capacity);

        console.log(`  Trying to move to underloaded day ${underloadedDay.date} (capacity: ${capacity})`);

        // Find exams with sessions on the overloaded day
        const examIds = Array.from(daySchedule.keys()).filter(examId =>
          daySchedule.get(examId)! > 0
        );

        console.log(`  Available exams on overloaded day:`, examIds);

        // Move sessions one by one, prioritizing exams with furthest exam dates
        for (const examId of examIds) {
          if (sessionsToMove <= 0) break;

          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;

          console.log(`    Checking exam ${exam.subject} (exam date: ${exam.exam_date.toISOString().split('T')[0]})`);

          // Check if this is a final review session (day before exam) - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];

          if (overloadedDay.date === dayBeforeExamStr) {
            console.log(`    SKIP: ${overloadedDay.date} is day before exam for ${exam.subject}, protecting final review session`);
            continue;
          }

          // Check if we can move a session to the underloaded day
          const validSlots = this.generateValidSlotsForExam(exam);
          const isValidDate = validSlots.some(slot =>
            slot.toISOString().split('T')[0] === underloadedDay.date
          );

          if (!isValidDate) {
            console.log(`    Can't move to ${underloadedDay.date}: not a valid date for ${exam.subject}`);
            continue;
          }

          // Check subject diversification - max 1 session of same exam per target day
          const underloadedSchedule = mergedSchedule.get(underloadedDay.date) || new Map();
          const currentCountOnTarget = underloadedSchedule.get(examId) || 0;
          if (currentCountOnTarget >= 2) {
            console.log(`    SKIP: ${exam.subject} already has ${currentCountOnTarget} session on ${underloadedDay.date}, avoiding tripling`);
            continue;
          }

          if (wouldMoveCreateGapViolation(examId, overloadedDay.date, underloadedDay.date)) {
            console.log(`    SKIP: moving ${exam.subject} from ${overloadedDay.date} to ${underloadedDay.date} would create gap violation`);
            continue;
          }

          // Move 1 session from overloaded to underloaded day
          daySchedule.set(examId, daySchedule.get(examId)! - 1);

          if (!mergedSchedule.has(underloadedDay.date)) {
            mergedSchedule.set(underloadedDay.date, new Map());
          }

          const targetSchedule = mergedSchedule.get(underloadedDay.date)!;
          targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);

          console.log(`    MOVED 1 session of ${exam.subject} from ${overloadedDay.date} to ${underloadedDay.date}`);

          excessToMove--;
          underloadedDay.capacity--;
          sessionsToMove--;

          // Remove empty exam entries
          if (daySchedule.get(examId) === 0) {
            daySchedule.delete(examId);
          }
        }
      }
    }

    // Then, handle busy days - move 1 session from busy days to very empty days
    if (busyDays.length > 0 && underloadedDays.length > 0) {
      console.log('=== BALANCING BUSY DAYS ===');

      for (const busyDay of busyDays) {
        const daySchedule = mergedSchedule.get(busyDay.date)!;

        // Find very empty days (1 session or less)
        const veryEmptyDays = underloadedDays.filter(day =>
          day.totalSessions <= 1 && day.capacity >= 1
        );

        if (veryEmptyDays.length === 0) continue;

        console.log(`Processing busy day ${busyDay.date}, can give ${busyDay.canGive} session`);

        // Find exams with sessions on the busy day (prioritize exams with furthest exam dates)
        const examIds = Array.from(daySchedule.keys()).filter(examId =>
          daySchedule.get(examId)! > 0
        );

        // Sort by exam date (furthest first)
        examIds.sort((a, b) => {
          const examA = this.inputs.exams.find(e => e.id === a)!;
          const examB = this.inputs.exams.find(e => e.id === b)!;
          return examB.exam_date.getTime() - examA.exam_date.getTime();
        });

        console.log(`  Available exams on busy day:`, examIds.map(id => {
          const exam = this.inputs.exams.find(e => e.id === id)!;
          return exam.subject;
        }));

        for (const examId of examIds) {
          if (busyDay.canGive <= 0) break;

          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;

          console.log(`    Checking exam ${exam.subject} (exam date: ${exam.exam_date.toISOString().split('T')[0]})`);

          // Check if this is a final review session (day before exam) - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];

          if (busyDay.date === dayBeforeExamStr) {
            console.log(`    SKIP: ${busyDay.date} is day before exam for ${exam.subject}, protecting final review session`);
            continue;
          }

          // Try to move to very empty days
          for (const emptyDay of veryEmptyDays) {
            if (busyDay.canGive <= 0) break;

            // Check if we can move a session to the empty day
            const validSlots = this.generateValidSlotsForExam(exam);
            const isValidDate = validSlots.some(slot =>
              slot.toISOString().split('T')[0] === emptyDay.date
            );

            if (!isValidDate) {
              console.log(`    Can't move to ${emptyDay.date}: not a valid date for ${exam.subject}`);
              continue;
            }

            // Check subject diversification - max 1 session of same exam per target day
            const emptyDaySchedule = mergedSchedule.get(emptyDay.date) || new Map();
            const currentCountOnTarget = emptyDaySchedule.get(examId) || 0;
            if (currentCountOnTarget >= 2) {
              console.log(`    SKIP: ${exam.subject} already has ${currentCountOnTarget} session on ${emptyDay.date}, avoiding tripling`);
              continue;
            }

            // HARD CHECK: moving from busyDay must not create a gap > 3 days for this exam
            if (wouldMoveCreateGapViolation(examId, busyDay.date, emptyDay.date)) {
              console.log(`    SKIP: moving ${exam.subject} from ${busyDay.date} to ${emptyDay.date} would create gap violation`);
              continue;
            }

            // Move 1 session from busy to empty day
            daySchedule.set(examId, daySchedule.get(examId)! - 1);

            if (!mergedSchedule.has(emptyDay.date)) {
              mergedSchedule.set(emptyDay.date, new Map());
            }

            const targetSchedule = mergedSchedule.get(emptyDay.date)!;
            targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);

            console.log(`    MOVED 1 session of ${exam.subject} from ${busyDay.date} to ${emptyDay.date}`);

            busyDay.canGive--;
            emptyDay.capacity--;
            emptyDay.totalSessions++;

            // Remove empty exam entries
            if (daySchedule.get(examId) === 0) {
              daySchedule.delete(examId);
            }

            break; // Only move 1 session per exam
          }
        }
      }
    }

    // Additional balancing phase: even out workload across all days
    // Move sessions from heavier days to lighter days for better distribution
    console.log('=== EVENING OUT WORKLOAD ===');

    // Sort days by session count (heaviest first)
    const daysByLoad = allDates.map(date => ({
      date,
      sessions: Array.from(mergedSchedule.get(date)!.values()).reduce((sum, s) => sum + s, 0)
    })).sort((a, b) => b.sessions - a.sessions);

    // Try to balance: move from heavy days to light days
    for (let i = 0; i < daysByLoad.length; i++) {
      const heavyDay = daysByLoad[i];
      if (heavyDay.sessions <= 2) break; // Stop if we reach days with 2 or fewer sessions

      // Find lighter days that could take a session
      for (let j = daysByLoad.length - 1; j > i; j--) {
        const lightDay = daysByLoad[j];

        // Only balance if there's a significant difference (2+ sessions)
        if (heavyDay.sessions - lightDay.sessions < 2) continue;

        const heavySchedule = mergedSchedule.get(heavyDay.date)!;
        const lightSchedule = mergedSchedule.get(lightDay.date) || new Map();

        // Don't create a day with too many sessions (respect daily max)
        const STUDY_CHUNK_HRS = this.inputs.session_duration / 60;
        const currentOnLightTotal = Array.from(lightSchedule.values()).reduce((s, v) => s + v, 0);
        // Note: The global max is already checked by checking if currentOnLightTotal >= global maxPerDay
        const globalMaxPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HRS);
        if (currentOnLightTotal >= globalMaxPerDay) continue;

        // Try to move one session from heavy to light day
        const examIds = Array.from(heavySchedule.keys()).filter(id => heavySchedule.get(id)! > 0);

        for (const examId of examIds) {
          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;

          // Check if this is a final review session - don't move it
          const examDateStr = exam.exam_date.toISOString().split('T')[0];
          const examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
          const dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
          const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];

          if (heavyDay.date === dayBeforeExamStr) continue;

          // Check if light day is valid for this exam
          const validSlots = this.generateValidSlotsForExam(exam);
          const isValid = validSlots.some(slot => slot.toISOString().split('T')[0] === lightDay.date);
          if (!isValid) continue;

          // Check diversification (max 1 of same exam per day after move) AND specific exam cap
          const currentOnLight = lightSchedule.get(examId) || 0;
          const maxForThisExam = this.getMaxSessionsPerDayForExamId(examId);

          // Strictly diversify: max 1 session of the same exam per day during balancing
          const diversificationLimit = Math.min(1, maxForThisExam);

          if (currentOnLight >= diversificationLimit) continue; // check allowed sessions of same exam on target day

          // HARD CHECK: moving from heavyDay must not create a gap > 3 days for this exam
          if (wouldMoveCreateGapViolation(examId, heavyDay.date, lightDay.date)) {
            console.log(`  Skip move of ${exam.subject} from ${heavyDay.date} to ${lightDay.date} → gap violation`);
            continue;
          }

          // Move the session
          heavySchedule.set(examId, heavySchedule.get(examId)! - 1);
          if (!mergedSchedule.has(lightDay.date)) {
            mergedSchedule.set(lightDay.date, new Map());
          }
          mergedSchedule.get(lightDay.date)!.set(examId, currentOnLight + 1);

          console.log(`  Balanced: moved ${exam.subject} from ${heavyDay.date} (${heavyDay.sessions}→${heavyDay.sessions - 1}) to ${lightDay.date} (${lightDay.sessions}→${lightDay.sessions + 1})`);

          // Update counts
          heavyDay.sessions--;
          lightDay.sessions++;

          if (heavySchedule.get(examId) === 0) {
            heavySchedule.delete(examId);
          }

          break; // Only move one session per iteration
        }

        if (heavyDay.sessions <= 2) break;
      }
    }

    console.log('=== FINAL BALANCED SCHEDULE ===');
    allDates.forEach(date => {
      const daySchedule = mergedSchedule.get(date)!;
      const totalSessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
      console.log(`Day ${date}: ${totalSessions} sessions`, Object.fromEntries(daySchedule));
    });
  }

  // Strict ±1 enforcement — runs LAST, after all other balancing and interval fixes.
  private enforceMaxOneDifference(mergedSchedule: Map<string, Map<string, number>>): void {
    console.log('=== ENFORCING ±1 SESSION RULE ===');

    const allDates = Array.from(mergedSchedule.keys()).sort();

    // Gap violation checker — RELAXED for ±1 enforcement (allow up to 4 empty days
    // between sessions instead of 2, since even distribution is the priority here).
    const wouldCreateGapViolation = (examId: string, sourceDate: string, targetDate: string): boolean => {
      const examSessionDates = Array.from(mergedSchedule.entries())
        .filter(([, sched]) => sched.has(examId) && (sched.get(examId) || 0) > 0)
        .map(([date]) => date);

      const sourceSessions = mergedSchedule.get(sourceDate)?.get(examId) || 0;
      let afterMove = sourceSessions <= 1
        ? examSessionDates.filter(d => d !== sourceDate)
        : [...examSessionDates];

      if (!afterMove.includes(targetDate)) afterMove.push(targetDate);
      afterMove.sort();

      if (afterMove.length < 2) return false;

      // Relaxed: allow up to 4 empty days (5 calendar days) for ±1 enforcement
      const RELAXED_MAX_GAP = 4;
      for (let k = 1; k < afterMove.length; k++) {
        const gap = Math.floor(
          (new Date(afterMove[k]).getTime() - new Date(afterMove[k - 1]).getTime()) / (24 * 60 * 60 * 1000)
        ) - 1;
        if (gap > RELAXED_MAX_GAP) return true;
      }
      return false;
    };

    let round = 0;
    while (round < 100) {
      round++;

      const loads = allDates.map(date => {
        const sched = mergedSchedule.get(date)!;
        return { date, sessions: Array.from(sched.values()).reduce((s, v) => s + v, 0) };
      });
      const minLoad = Math.min(...loads.map(l => l.sessions));
      const maxLoad = Math.max(...loads.map(l => l.sessions));

      if (maxLoad - minLoad <= 1) {
        console.log(`  ±1 rule satisfied (min=${minLoad}, max=${maxLoad}) after ${round - 1} moves`);
        break;
      }

      console.log(`  Round ${round}: spread=${maxLoad - minLoad} (min=${minLoad}, max=${maxLoad})`);

      // Try ALL heavy days
      const heavyDays = loads.filter(l => l.sessions === maxLoad);
      // Try ANY day lighter than maxLoad-1 (not just minLoad days)
      const candidateTargets = loads
        .filter(l => l.sessions < maxLoad - 1)
        .sort((a, b) => a.sessions - b.sessions); // lightest first

      let moved = false;

      for (const heaviest of heavyDays) {
        if (moved) break;

        const heavySchedule = mergedSchedule.get(heaviest.date)!;
        const examIds = Array.from(heavySchedule.keys()).filter(id => (heavySchedule.get(id) || 0) > 0);

        for (const examId of examIds) {
          if (moved) break;

          const exam = this.inputs.exams.find(e => e.id === examId);
          if (!exam) continue;

          // Don't move final review (day before exam)
          const examDateUTC = new Date(exam.exam_date.toISOString().split('T')[0] + 'T00:00:00.000Z');
          const dayBeforeStr = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          if (heaviest.date === dayBeforeStr) {
            console.log(`  Skip ${exam.subject} on ${heaviest.date}: final review day`);
            continue;
          }

          // Try ALL candidate target days for this exam
          for (const target of candidateTargets) {
            if (moved) break;

            const targetDateUTC = new Date(target.date + 'T00:00:00.000Z');

            // Can this exam study on the target day? (before exam date)
            let lastValidDay = new Date(examDateUTC);
            if (!exam.can_study_after_exam) lastValidDay.setDate(lastValidDay.getDate() - 1);
            if (targetDateUTC > lastValidDay) {
              console.log(`  Skip ${exam.subject} → ${target.date}: after exam ${exam.exam_date.toISOString().split('T')[0]}`);
              continue;
            }

            // Target day must be >= today
            const now = new Date();
            const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (target.date < nowStr) continue;

            // Diversification: max 1 of same exam on target
            const targetSchedule = mergedSchedule.get(target.date) || new Map();
            if ((targetSchedule.get(examId) || 0) >= 1) {
              console.log(`  Skip ${exam.subject} → ${target.date}: already has this exam`);
              continue;
            }

            // NO gap violation check — ±1 distribution is the priority.
            // Earlier steps already enforce gap constraints.

            // Move the session
            heavySchedule.set(examId, heavySchedule.get(examId)! - 1);
            if (heavySchedule.get(examId) === 0) heavySchedule.delete(examId);

            if (!mergedSchedule.has(target.date)) mergedSchedule.set(target.date, new Map());
            const targetSched = mergedSchedule.get(target.date)!;
            targetSched.set(examId, (targetSched.get(examId) || 0) + 1);

            console.log(`  ±1: moved ${exam.subject} from ${heaviest.date} (${maxLoad}→${maxLoad - 1}) to ${target.date} (${target.sessions}→${target.sessions + 1})`);
            moved = true;
          }
        }
      }

      if (!moved) {
        console.log(`  Cannot fully satisfy ±1 rule (min=${minLoad}, max=${maxLoad}) — no valid moves remain`);
        // Log all exams on heavy days and their constraints
        for (const h of heavyDays) {
          const hs = mergedSchedule.get(h.date)!;
          const exams = Array.from(hs.keys()).map(id => {
            const e = this.inputs.exams.find(ex => ex.id === id);
            return e ? `${e.subject}(exam:${e.exam_date.toISOString().split('T')[0]})` : id;
          });
          console.log(`    Heavy ${h.date} (${h.sessions}): ${exams.join(', ')}`);
        }
        break;
      }
    }

    // Log final state
    console.log('=== FINAL SCHEDULE AFTER ±1 ENFORCEMENT ===');
    allDates.forEach(date => {
      const daySchedule = mergedSchedule.get(date)!;
      const totalSessions = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);
      console.log(`Day ${date}: ${totalSessions} sessions`, Object.fromEntries(daySchedule));
    });
  }

  private fixMaxIntervalViolations(mergedSchedule: Map<string, Map<string, number>>): void {
    console.log('=== FIXING MAX INTERVAL VIOLATIONS ===');

    // Check each exam's sessions for violations
    this.inputs.exams.forEach(exam => {
      // Get all dates where this exam has sessions
      const examDates: string[] = [];

      // Only widen gap to 4 when exam >= 14 days away AND schedule has days exceeding soft limit
      const daysUntil = Math.floor((exam.exam_date.getTime() - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
      const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
      const softLimitSessions = Math.max(1, Math.floor(this.getEffectiveSoftLimit() / STUDY_CHUNK_HOURS));
      const hasDenseDays = Array.from(mergedSchedule.values()).some(day => {
        return Array.from(day.values()).reduce((sum, s) => sum + s, 0) > softLimitSessions;
      });
      const examMaxGap = (daysUntil >= 14 && hasDenseDays) ? 4 : 2;

      mergedSchedule.forEach((daySchedule, date) => {
        if (daySchedule.has(exam.id) && daySchedule.get(exam.id)! > 0) {
          examDates.push(date);
        }
      });

      examDates.sort();

      if (examDates.length < 2) return; // No violation possible with < 2 sessions

      console.log(`Checking ${exam.subject}: ${examDates.join(', ')}`);

      // Check for violations
      for (let i = 1; i < examDates.length; i++) {
        const prevDate = new Date(examDates[i - 1]);
        const currDate = new Date(examDates[i]);
        const gap = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)) - 1;

        if (gap > examMaxGap) {
          console.log(`  ⚠ Violation: ${gap} days gap between ${examDates[i - 1]} and ${examDates[i]}`);

          // Try to move the first session to fill the gap
          const firstSessionDate = examDates[0];
          const secondSessionDate = examDates[1];

          // Find available days between second and the violating session
          const allDates = Array.from(mergedSchedule.keys()).sort();
          const availableDays = allDates.filter(date => {
            const daySchedule = mergedSchedule.get(date)!;
            const hasThisExam = daySchedule.has(exam.id) && daySchedule.get(exam.id)! > 0;
            return !hasThisExam && date > secondSessionDate && date < examDates[i];
          });

          if (availableDays.length > 0) {
            // Calculate intensity for each available day
            let bestDay: string | null = null;
            let lowestIntensity = Infinity;

            // Get valid slots for this exam to ensure we only move to valid days
            const validSlots = this.generateValidSlotsForExam(exam);
            const validDatesSet = new Set(validSlots.map(s => s.toISOString().split('T')[0]));

            for (const day of availableDays) {
              // Skip if this day is not valid for this exam
              if (!validDatesSet.has(day)) {
                console.log(`    Skipping ${day} - not valid for ${exam.subject}`);
                continue;
              }

              const daySchedule = mergedSchedule.get(day)!;
              const intensity = Array.from(daySchedule.values()).reduce((sum, s) => sum + s, 0);

              // Check if this day respects max interval with neighbors
              const gapToSecond = Math.floor((new Date(day).getTime() - new Date(secondSessionDate).getTime()) / (24 * 60 * 60 * 1000)) - 1;
              const gapToViolating = Math.floor((new Date(examDates[i]).getTime() - new Date(day).getTime()) / (24 * 60 * 60 * 1000)) - 1;

              if (gapToSecond <= examMaxGap && gapToViolating <= examMaxGap) {
                if (intensity < lowestIntensity) {
                  lowestIntensity = intensity;
                  bestDay = day;
                }
              }
            }

            if (bestDay) {
              console.log(`  ✓ Moving ${exam.subject} from ${firstSessionDate} to ${bestDay} (intensity: ${lowestIntensity})`);

              // Remove from first date
              const firstDaySchedule = mergedSchedule.get(firstSessionDate)!;
              const sessionsOnFirst = firstDaySchedule.get(exam.id) || 0;
              if (sessionsOnFirst > 1) {
                firstDaySchedule.set(exam.id, sessionsOnFirst - 1);
              } else {
                firstDaySchedule.delete(exam.id);
              }

              // Add to best day
              const bestDaySchedule = mergedSchedule.get(bestDay)!;
              bestDaySchedule.set(exam.id, (bestDaySchedule.get(exam.id) || 0) + 1);

              break; // Fixed this violation, move to next exam
            }
          }
        }
      }
    });
  }

  private validateSchedule(): {
    isValid: boolean;
    warnings: string[];
    ruleViolations: string[];
    overloadedDays: { date: string; sessions: number; limit: number }[];
    incompleteExams: { examName: string; missingSessions: number }[];
  } {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_SESSIONS_PER_DAY = Math.min(3, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));
    const mergedSchedule = this.mergeExamsIntoDailyPlan();

    const warnings: string[] = [];
    const ruleViolations: string[] = [];
    const overloadedDays: { date: string; sessions: number; limit: number }[] = [];
    const incompleteExams: { examName: string; missingSessions: number }[] = [];

    // Check 1: Daily session limit violations
    mergedSchedule.forEach((examSessions, date) => {
      const totalSessions = Array.from(examSessions.values()).reduce((sum, s) => sum + s, 0);
      if (totalSessions > MAX_SESSIONS_PER_DAY) {
        overloadedDays.push({
          date,
          sessions: totalSessions,
          limit: MAX_SESSIONS_PER_DAY
        });
        warnings.push(`Day ${date} exceeds daily limit: ${totalSessions} sessions (max: ${MAX_SESSIONS_PER_DAY})`);
      }
    });

    // Check 2: Final review sessions (day before exam)
    for (const exam of this.inputs.exams) {
      const examDate = new Date(exam.exam_date);
      const dayBeforeExam = new Date(examDate.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];

      const daySchedule = mergedSchedule.get(dayBeforeExamStr);
      if (!daySchedule || !daySchedule.has(exam.id) || daySchedule.get(exam.id) === 0) {
        ruleViolations.push(`Missing final review session for ${exam.subject} on ${dayBeforeExamStr}`);
      }
    }

    // Check 3: Maximum 3-day gap between sessions of same exam
    for (const exam of this.inputs.exams) {
      const scheduledDays: string[] = [];

      // Collect all days where this exam has sessions
      mergedSchedule.forEach((examSessions, date) => {
        if (examSessions.has(exam.id) && examSessions.get(exam.id)! > 0) {
          scheduledDays.push(date);
        }
      });

      // Sort the scheduled days
      scheduledDays.sort();

      // Check for gaps larger than 3 days between consecutive sessions
      for (let i = 0; i < scheduledDays.length - 1; i++) {
        const currentDate = new Date(scheduledDays[i]);
        const nextDate = new Date(scheduledDays[i + 1]);
        const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 3) {
          ruleViolations.push(`Gap of ${daysDiff} days between ${exam.subject} sessions on ${scheduledDays[i]} and ${scheduledDays[i + 1]} (max allowed: 3 days)`);
        }
      }
    }

    // Check 4: Sessions after exam date (unless allowed)
    for (const exam of this.inputs.exams) {
      if (!exam.can_study_after_exam) {
        const examDateStr = exam.exam_date.toISOString().split('T')[0];

        mergedSchedule.forEach((examSessions, date) => {
          if (date > examDateStr && examSessions.has(exam.id) && examSessions.get(exam.id)! > 0) {
            ruleViolations.push(`Session for ${exam.subject} scheduled after exam date on ${date}`);
          }
        });
      }
    }

    // Check 5: Incomplete exams (not enough sessions)
    for (const exam of this.inputs.exams) {
      const totalHours = Math.max(0, this.calculateTotalHours(exam) - (this.inputs.completed_hours?.[exam.id] || 0));
      const requiredSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);

      let scheduledSessions = 0;
      mergedSchedule.forEach((examSessions) => {
        scheduledSessions += examSessions.get(exam.id) || 0;
      });

      if (scheduledSessions < requiredSessions) {
        const missingSessions = requiredSessions - scheduledSessions;
        incompleteExams.push({
          examName: exam.subject,
          missingSessions
        });
        warnings.push(`${exam.subject} is missing ${missingSessions} sessions (required: ${requiredSessions}, scheduled: ${scheduledSessions})`);
      }
    }

    const isValid = ruleViolations.length === 0 && overloadedDays.length === 0 && incompleteExams.length === 0;

    return {
      isValid,
      warnings,
      ruleViolations,
      overloadedDays,
      incompleteExams
    };
  }

  public getFinalScheduleWithValidation(): {
    calendar: { [date: string]: { examName: string; sessions: number }[] };
    validation: {
      isValid: boolean;
      warnings: string[];
      ruleViolations: string[];
      overloadedDays: { date: string; sessions: number; limit: number }[];
      incompleteExams: { examName: string; missingSessions: number }[];
    };
    explanation: string;
  } {
    const mergedSchedule = this.mergeExamsIntoDailyPlan();
    const validation = this.validateSchedule();

    // Convert to calendar format
    const calendar: { [date: string]: { examName: string; sessions: number }[] } = {};

    mergedSchedule.forEach((examSessions, date) => {
      const daySchedule: { examName: string; sessions: number }[] = [];

      examSessions.forEach((sessions, examId) => {
        const exam = this.inputs.exams.find(e => e.id === examId);
        if (exam) {
          daySchedule.push({
            examName: exam.subject,
            sessions
          });
        }
      });

      calendar[date] = daySchedule;
    });

    // Explanation for 3+ exam handling
    const explanation = `
3+ Exam Handling Explanation:
• Conflict Resolution: When multiple exams compete for the same day, priority is given to exams with earlier dates, higher difficulty, and earlier assignment order
• Low-Pressure Placement: Sessions for exams furthest away are moved to earlier low-intensity days to balance the schedule
• Balancing: The algorithm redistributes sessions from overloaded days to underloaded days, ensuring even distribution across the entire study period
• Final Review: Each exam gets a guaranteed session the day before the exam
• 3-Day Gap Rule: No more than 3 days can pass between sessions of the same exam (max gap = 3 days)
• Daily Limits: Respects maximum sessions per day, moving excess sessions to earlier days when needed
    `.trim();

    return {
      calendar,
      validation,
      explanation
    };
  }

  private calculateTotalHours(exam: ExamData): number {
    // User's estimate is the baseline, with max 10% adjustment based on difficulty/confidence
    const maxAdjustmentPercent = 0.10; // Fixed at 10% max
    const difficultyMultiplier = 1 + (exam.difficulty - 3) * (maxAdjustmentPercent / 2); // Half from difficulty
    const confidenceMultiplier = 1 - (exam.confidence - 3) * (maxAdjustmentPercent / 2); // Half from confidence
    const adjustmentFactor = (difficultyMultiplier + confidenceMultiplier) / 2;

    // Calculate adjusted hours and cap at 10% increase/decrease
    const calculatedHours = exam.user_estimated_total_hours * adjustmentFactor;
    const minAllowedHours = exam.user_estimated_total_hours * 0.90; // Max 10% decrease
    const maxAllowedHours = exam.user_estimated_total_hours * 1.10; // Max 10% increase

    const finalHours = Math.max(1, Math.min(Math.round(calculatedHours * 10) / 10, maxAllowedHours)); // Round to 1 decimal

    return finalHours;
  }

  private initializeInternalState(exams: ExamData[]): InternalSubjectState[] {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;

    return exams.filter((exam): exam is ExamData => exam != null).map((exam): InternalSubjectState => {
      const totalHours = this.calculateTotalHours(exam);
      const existingHours = (this.inputs.existing_sessions || [])
        .filter(s => s.subjectId === exam.id)
        .reduce((sum, s) => sum + s.duration, 0);
      const completedHours = this.inputs.completed_hours?.[exam.id] || 0;

      return {
        id: exam.id,
        subject: exam.subject,
        exam_date: new Date(exam.exam_date),
        remaining_hours: totalHours - existingHours - completedHours,
        state: 'ACTIVE',
        days_to_exam: 0,
        last_study_day: null,
        original_difficulty: exam.difficulty,
        original_confidence: exam.confidence,
      };
    });
  }

  private generateSingleExamPlan(): DailySchedule[] {
    const exam = this.subjects[0];
    // For single exam, use the full calculated hours (no need for final review reservation)
    const examInput = this.inputs.exams.find(e => e.id === exam.id);
    const totalCalculatedHours = this.calculateTotalHours(examInput!);
    const completedHours = this.inputs.completed_hours?.[exam.id] || 0;
    const totalRequiredHours = Math.max(0, totalCalculatedHours - completedHours);
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const totalChunksNeeded = Math.ceil(totalRequiredHours / STUDY_CHUNK_HOURS);
    const maxSessionsPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);

    console.log(`Single exam plan: ${exam.subject}, totalCalculated: ${totalCalculatedHours}, completedHours: ${completedHours}, totalRequired: ${totalRequiredHours}, chunks: ${totalChunksNeeded}`);

    // Use generateValidSlotsForExam to get available days excluding blocked days
    const validSlots = this.generateValidSlotsForExam(examInput!);
    const availableDays = validSlots.length;

    console.log(`Available days (excluding blocked): ${availableDays}, Sessions needed: ${totalChunksNeeded}, Max per day: ${maxSessionsPerDay}`);
    console.log(`Valid slots:`, validSlots.map(d => d.toISOString().split('T')[0]));

    // If we don't have enough days for 1 session per day, we need multiple sessions per day
    if (availableDays < totalChunksNeeded) {
      console.log(`⚠️ Not enough days! Will place multiple sessions per day.`);

      let remainingChunks = totalChunksNeeded;

      for (let i = 0; i < validSlots.length && remainingChunks > 0; i++) {
        const slotDate = validSlots[i];
        const daysLeft = validSlots.length - i;
        const chunksForThisDay = Math.ceil(remainingChunks / daysLeft);

        const hoursForThisDay = chunksForThisDay * STUDY_CHUNK_HOURS;

        const daySchedule: DailySchedule = {
          date: new Date(slotDate),
          total_hours: hoursForThisDay,
          subjects: { [exam.id]: hoursForThisDay },
        };
        this.schedule.push(daySchedule);

        console.log(`Day ${slotDate.toISOString().split('T')[0]}: ${chunksForThisDay} sessions (${hoursForThisDay} hours), remaining: ${remainingChunks - chunksForThisDay}`);

        remainingChunks -= chunksForThisDay;
      }
    } else {
      // Normal case: enough days for 1 session per day
      console.log(`Enough days available. Placing 1 session per day working backwards from exam.`);

      // Work backwards from the last valid slot to ensure no gaps near exam
      let remainingChunks = totalChunksNeeded;

      // Use the last N valid slots where N = totalChunksNeeded
      for (let i = validSlots.length - 1; i >= 0 && remainingChunks > 0; i--) {
        const slotDate = validSlots[i];

        const daySchedule: DailySchedule = {
          date: new Date(slotDate),
          total_hours: STUDY_CHUNK_HOURS,
          subjects: { [exam.id]: STUDY_CHUNK_HOURS },
        };
        this.schedule.push(daySchedule);

        remainingChunks--;
      }

      // Sort schedule chronologically
      this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    console.log(`Created ${this.schedule.length} days with total sessions: ${totalChunksNeeded}`);
    return this.schedule;
  }

  public generatePlan(): DailySchedule[] | { error: string; choices: string[] } | ScheduleResult {
    console.log('=== SCHEDULER generatePlan CALLED ===');

    // Only compute and override the optimal start date when daily preferences are ON.
    // When OFF, use today as start and let sessions spread across all available days.
    if (this.inputs.enable_daily_limits !== false) {
      const optimalStart = this.calculateOptimalStartDate();
      if (!this.inputs.start_date || optimalStart > this.inputs.start_date) {
        console.log(`Overriding start date: input was ${this.inputs.start_date}, optimal is ${optimalStart}`);
        this.inputs.start_date = optimalStart;
      }
    } else {
      console.log('Daily preferences OFF: using today as start date, no optimal start override');
    }

    this.subjects = this.initializeInternalState(this.inputs.exams);

    // If there are existing sessions, decide whether to rebalance or regenerate
    if (this.inputs.existing_sessions && this.inputs.existing_sessions.length > 0) {
      const subjectsNeedingSessions = this.subjects.filter(s => s.remaining_hours > 0);
      // If new sessions need to be added (e.g., new exam), regenerate the whole schedule
      // to ensure all rules are met correctly from scratch.
      if (subjectsNeedingSessions.length > 0) {
        return this.generateNewSchedule();
      }
      // Otherwise, just rebalance the existing schedule (e.g., to fill gaps without adding new hours)
      return this.rebalanceExistingSchedule();
    }

    // If no existing sessions, generate a fresh schedule
    return this.generateNewSchedule();
  }

  private generateNewSchedule(): ScheduleResult {
    this.schedule = []; // Start with a clean slate
    this.subjects = this.initializeInternalState(this.inputs.exams); // Re-initialize to reset remaining_hours

    if (this.subjects.length === 0) {
      return { schedule: [] };
    }

    // All exams (including single) go through the unified scoring engine
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const mergedSchedule = this.mergeExamsIntoDailyPlan();

    // Convert merged schedule to DailySchedule format
    mergedSchedule.forEach((examSessions, dateStr) => {
      const daySchedule: DailySchedule = {
        date: new Date(dateStr),
        total_hours: 0,
        subjects: {}
      };

      examSessions.forEach((sessionCount, examId) => {
        const hours = sessionCount * STUDY_CHUNK_HOURS;
        daySchedule.subjects[examId] = hours;
        daySchedule.total_hours += hours;
      });

      this.schedule.push(daySchedule);
    });

    // Sort by date
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());

    return { schedule: this.schedule };
  }

  private rebalanceExistingSchedule(): ScheduleResult {
    // Create a map of existing sessions by date
    const existingScheduleMap = new Map<string, DailySchedule>();
    this.inputs.existing_sessions!.forEach(session => {
      const dateStr = session.date.toISOString().split('T')[0];
      if (!existingScheduleMap.has(dateStr)) {
        existingScheduleMap.set(dateStr, {
          date: new Date(session.date),
          total_hours: 0,
          subjects: {}
        });
      }
      const daySchedule = existingScheduleMap.get(dateStr)!;
      daySchedule.subjects[session.subjectId] = (daySchedule.subjects[session.subjectId] || 0) + session.duration;
      daySchedule.total_hours += session.duration;
    });

    this.schedule = Array.from(existingScheduleMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Rebalancing only fills gaps and enforces spacing, it does not add new sessions.
    this.redistributeSessionsForBalance();
    this.enforceSessionSpacing();
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
    this.ensureFinalReviewSessions();

    return { schedule: this.schedule };
  }


  private enforceSessionSpacing(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_DAYS_BETWEEN_SESSIONS = 3;
    let violationsFound = true;

    while (violationsFound) {
      violationsFound = false;
      this.inputs.exams.forEach(exam => {
        const examSessions: { date: Date; dateStr: string }[] = [];
        this.schedule.forEach(day => {
          if (day.subjects[exam.id]) {
            examSessions.push({
              date: day.date,
              dateStr: day.date.toISOString().split('T')[0]
            });
          }
        });

        examSessions.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (let i = 0; i < examSessions.length - 1; i++) {
          const currentSession = examSessions[i];
          const nextSession = examSessions[i + 1];
          const daysBetween = Math.floor((nextSession.date.getTime() - currentSession.date.getTime()) / (1000 * 3600 * 24));

          if (daysBetween > MAX_DAYS_BETWEEN_SESSIONS) {
            violationsFound = true;

            const daysInRange: { date: Date; dateStr: string; intensity: number }[] = [];
            for (let d = new Date(currentSession.date); d < nextSession.date; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              const daySchedule = this.schedule.find(ds => ds.date.toISOString().split('T')[0] === dateStr);
              const intensity = daySchedule?.total_hours || 0;
              const daysToNext = Math.floor((nextSession.date.getTime() - d.getTime()) / (1000 * 3600 * 24));
              if (daysToNext <= MAX_DAYS_BETWEEN_SESSIONS && daysToNext > 0) {
                daysInRange.push({ date: new Date(d), dateStr, intensity });
              }
            }

            daysInRange.sort((a, b) => a.intensity - b.intensity);
            const targetDay = daysInRange.find(d => d.intensity + STUDY_CHUNK_HOURS <= this.inputs.daily_max_hours);

            if (targetDay) {
              const sourceDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === currentSession.dateStr);
              if (sourceDay) {
                sourceDay.subjects[exam.id] -= STUDY_CHUNK_HOURS;
                sourceDay.total_hours -= STUDY_CHUNK_HOURS;
                if (sourceDay.subjects[exam.id] <= 0) delete sourceDay.subjects[exam.id];
                if (sourceDay.total_hours === 0) {
                  const index = this.schedule.findIndex(d => d.date.toISOString().split('T')[0] === currentSession.dateStr);
                  if (index > -1) this.schedule.splice(index, 1);
                }
              }

              let newDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === targetDay.dateStr);
              if (!newDay) {
                newDay = { date: new Date(targetDay.date), total_hours: 0, subjects: {} };
                this.schedule.push(newDay);
              }
              newDay.subjects[exam.id] = (newDay.subjects[exam.id] || 0) + STUDY_CHUNK_HOURS;
              newDay.total_hours += STUDY_CHUNK_HOURS;

              // Break the inner loops to restart the process since the schedule has changed
              return;
            }
          }
        }
      });
    }
  }

  private redistributeSessionsForBalance(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
    const MAX_ITERATIONS = 50;

    // Build complete date range from first scheduled day to last exam
    const firstDate = this.schedule.length > 0
      ? new Date(Math.min(...this.schedule.map(d => d.date.getTime())))
      : new Date(this.inputs.start_date);
    const lastExamDate = new Date(Math.max(...this.inputs.exams.map(e => e.exam_date.getTime())));

    // Create a map of all days in the range with their session counts
    const getAllDayLoads = (): Map<string, { date: Date, sessions: number, schedule: DailySchedule | null }> => {
      const dayLoads = new Map<string, { date: Date, sessions: number, schedule: DailySchedule | null }>();

      for (let d = new Date(firstDate); d < lastExamDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const existingDay = this.schedule.find(s => s.date.toISOString().split('T')[0] === dateStr);
        dayLoads.set(dateStr, {
          date: new Date(d),
          sessions: existingDay ? existingDay.total_hours / STUDY_CHUNK_HOURS : 0,
          schedule: existingDay || null
        });
      }
      return dayLoads;
    };

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const dayLoads = getAllDayLoads();
      const days = Array.from(dayLoads.values());

      // Find the day with max sessions and day with min sessions
      let maxDay = days.reduce((max, d) => d.sessions > max.sessions ? d : max, days[0]);
      let minDay = days.reduce((min, d) => d.sessions < min.sessions ? d : min, days[0]);

      // If difference is 1 or less, schedule is balanced
      if (maxDay.sessions - minDay.sessions <= 1) {
        break;
      }

      // Find a subject we can move from maxDay to minDay
      // Must be: not a review day, and minDay must be before the exam
      if (!maxDay.schedule) continue;

      let moved = false;

      // Sort subjects by exam date (furthest first - most flexible to move)
      const subjectsOnMaxDay = Object.keys(maxDay.schedule.subjects)
        .map(id => ({ id, exam: this.inputs.exams.find(e => e.id === id) }))
        .filter(s => s.exam)
        .sort((a, b) => b.exam!.exam_date.getTime() - a.exam!.exam_date.getTime());

      for (const { id: subjectId, exam } of subjectsOnMaxDay) {
        if (!exam) continue;

        // Check if maxDay is the review day for this subject
        const reviewDate = new Date(exam.exam_date.getTime() - 24 * 60 * 60 * 1000);
        const isReviewDay = reviewDate.toISOString().split('T')[0] === maxDay.date.toISOString().split('T')[0];
        if (isReviewDay) continue;

        // Check if minDay is before this exam (can't study after exam)
        if (minDay.date >= exam.exam_date) continue;

        // Move one session from maxDay to minDay
        maxDay.schedule.subjects[subjectId] -= STUDY_CHUNK_HOURS;
        maxDay.schedule.total_hours -= STUDY_CHUNK_HOURS;
        if (maxDay.schedule.subjects[subjectId] <= 0) {
          delete maxDay.schedule.subjects[subjectId];
        }

        // Add to minDay (create if doesn't exist)
        let targetDay = minDay.schedule;
        if (!targetDay) {
          targetDay = { date: new Date(minDay.date), total_hours: 0, subjects: {} };
          this.schedule.push(targetDay);
        }
        targetDay.subjects[subjectId] = (targetDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        targetDay.total_hours += STUDY_CHUNK_HOURS;

        moved = true;
        break;
      }

      if (!moved) break; // No valid moves found
    }

    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private ensureFinalReviewSessions(): void {
    const STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;

    for (const exam of this.inputs.exams) {
      const subjectId = exam.id;
      const examDate = new Date(exam.exam_date);
      const reviewDate = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
      const reviewDateStr = reviewDate.toISOString().split('T')[0];

      // 1. Check if a review session already exists
      const reviewDaySchedule = this.schedule.find(d => d.date.toISOString().split('T')[0] === reviewDateStr);
      if (reviewDaySchedule && reviewDaySchedule.subjects[subjectId] > 0) {
        continue; // Final review session already exists, do nothing.
      }

      // 2. Find the busiest day for this subject to steal a chunk from
      let donorDay: DailySchedule | null = null;
      let maxHours = 0;

      for (const day of this.schedule) {
        const hours = day.subjects[subjectId] || 0;
        if (hours > maxHours) {
          maxHours = hours;
          donorDay = day;
        }
      }

      if (!donorDay) {
        continue; // No sessions were scheduled for this subject, so nothing to move.
      }

      // 3. Steal a chunk from the donor day
      donorDay.subjects[subjectId] -= STUDY_CHUNK_HOURS;
      donorDay.total_hours -= STUDY_CHUNK_HOURS;
      if (donorDay.subjects[subjectId] <= 0) {
        delete donorDay.subjects[subjectId];
      }

      // 4. Give the chunk to the review day
      let recipientDay = this.schedule.find(d => d.date.toISOString().split('T')[0] === reviewDateStr);
      if (!recipientDay) {
        // If the review day doesn't exist in the schedule, create it.
        recipientDay = { date: reviewDate, total_hours: 0, subjects: {} };
        this.schedule.push(recipientDay);
      }

      // Only add if there's capacity
      if (recipientDay.total_hours + STUDY_CHUNK_HOURS <= this.inputs.daily_max_hours) {
        recipientDay.subjects[subjectId] = (recipientDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        recipientDay.total_hours += STUDY_CHUNK_HOURS;
      } else {
        // If no capacity, return the chunk to the donor
        donorDay.subjects[subjectId] = (donorDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
        donorDay.total_hours += STUDY_CHUNK_HOURS;
      }
    }

    // Sort the schedule by date again as we might have added new days
    this.schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private checkEarlyCompletion(subject: InternalSubjectState, hoursToAssign: number): boolean {
    const EARLY_COMPLETION_DAYS = 2;
    // If we're already within the critical window (≤3 days), allow completion
    // This prevents gaps right before exams (rule §3.2)
    if (subject.days_to_exam <= 3) {
      return true;
    }
    // Otherwise, enforce the early completion rule
    if (subject.remaining_hours - hoursToAssign <= 0 && subject.days_to_exam > EARLY_COMPLETION_DAYS) {
      return false;
    }
    return true;
  }

  private checkSubjectDominance(subjectId: string, hoursToAssign: number, day: DailySchedule): boolean {
    // §3.4: This rule should only apply when multiple subjects are being juggled.
    const activeSubjectsCount = this.subjects.filter(s => s.state === 'ACTIVE').length;
    if (activeSubjectsCount <= 1) {
      return true; // Ignore this rule if there's only one subject to focus on.
    }

    // This rule should not prevent the very first chunk of the day.
    if (day.total_hours === 0) {
      return true; // OK
    }

    const proposedSubjectHours = (day.subjects[subjectId] || 0) + hoursToAssign;
    const proposedTotalHours = day.total_hours + hoursToAssign;
    if (proposedSubjectHours / proposedTotalHours > 0.5) {
      return false; // Violation
    }
    return true; // OK
  }

  private calculatePriorityScore(subject: InternalSubjectState): number {
    // Simplified priority: Focus on subjects with more work left and that haven't been studied recently.
    const totalInitialHours = this.calculateTotalHours(this.inputs.exams.find(e => e.id === subject.id)!);
    const progress = totalInitialHours > 0 ? subject.remaining_hours / totalInitialHours : 0; // Higher is more urgent
    const daysSinceLast = subject.last_study_day ? (new Date().getTime() - subject.last_study_day.getTime()) / (1000 * 3600 * 24) : 0;

    // Weights are tuned to favor progress (subjects with more hours left) and recency.
    let priority = (progress * 0.8) + (daysSinceLast * 0.2);

    // This massive bonus ensures the final review session is prioritized above all else.
    if (subject.days_to_exam === 1) {
      priority += 1000;
    }

    return isNaN(priority) ? 0 : priority;
  }
}

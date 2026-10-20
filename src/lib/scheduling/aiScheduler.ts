import { resolveStudyLanguage } from '@/lib/i18n/resolveStudyLanguage';

export interface ExamInput {
  id: string;
  subject: string;
  exam_date: Date;
  totalHours: number;
  can_study_after_exam: boolean;
  studyMaterials: Array<{
    chapter: string;
    difficulty: number;
    user_estimated_total_hours: number;
  }>;
}

export interface AISchedulerInputs {
  exams: ExamInput[];
  daily_max_hours: number;
  soft_daily_limit: number;
  session_duration: number; // minutes
  start_date: Date;
  blocked_days?: string[];
  existing_sessions?: { examId: string; content: string }[];
  allowOverload?: boolean;
  userProfile?: any;
}

export interface SessionBlock {
  content: string;
  durationMinutes: number;
}

function isDedicatedReviewBlock(content: string): boolean {
  if (!content) return false;
  // If it's a chapter with voorkennis / herhaling in parentheses, it's a chapter session, NOT the final revision block
  if (/^H\s*\d+/i.test(content) || /voorkennis/i.test(content)) return false;
  return /^(?:herhaling|eindherhaling|final\s*revision|revision|review|proeftoets|eindtoets)\b/i.test(content) ||
         /\b(proeftoets|eindtoets|mock\s*exam|practice\s*exam)\b/i.test(content);
}

/**
 * Generate a study schedule using EXACT material definitions.
 * Returns Map<date, Map<examId, Array<SessionBlock>>>
 */
export async function generateAISchedule(
  inputs: AISchedulerInputs
): Promise<{ schedule: Map<string, Map<string, Array<SessionBlock>>>, wasOverloaded: boolean }> {
  // Build available dates (from start to last exam, excluding blocked)
  const blockedSet = new Set(inputs.blocked_days || []);
  const rawLastTime = Math.max(...inputs.exams.map(e => new Date(e.exam_date).getTime()));
  
  // Truncate both to midnight UTC so the date loop is clean and inclusive
  const lastExamDate = isNaN(rawLastTime) ? new Date() : new Date(new Date(rawLastTime).toISOString().split('T')[0] + 'T00:00:00.000Z');
  const startDate = isNaN(new Date(inputs.start_date).getTime()) ? new Date() : new Date(new Date(inputs.start_date).toISOString().split('T')[0] + 'T00:00:00.000Z');

  const availableDates: string[] = [];
  console.log("START DATE:", startDate);
  console.log("LAST EXAM DATE:", lastExamDate);

  for (
    let d = new Date(startDate);
    d <= lastExamDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().split('T')[0];
    if (!blockedSet.has(dateStr)) {
      availableDates.push(dateStr);
    }
  }

  // ABSOLUTE GUARANTEE: availableDates must NEVER be empty.
  console.log("AVAILABLE DATES:", availableDates);
  if (availableDates.length === 0) {
    availableDates.push(startDate.toISOString().split('T')[0]);
  }

  const examTopics = new Map<string, SessionBlock[]>();
  
  for (const exam of inputs.exams) {
    let blocks: SessionBlock[] = [];
    console.log(`[DEBUG-AI] Exam: ${exam.id}, studyMaterials count: ${exam.studyMaterials?.length || 0}`);

    const examLang = resolveStudyLanguage(inputs.userProfile, `${exam.subject} ${exam.studyMaterials?.map(m => m.chapter).join(' ')}`);
    const isDutch = examLang === 'nl';
    const partWord = isDutch ? 'Deel' : (examLang === 'de' ? 'Teil' : (examLang === 'fr' ? 'Partie' : (examLang === 'es' ? 'Parte' : 'Part')));
    const reviewWord = isDutch ? 'Herhaling' : (examLang === 'de' ? 'Wiederholung' : (examLang === 'fr' ? 'Révision' : (examLang === 'es' ? 'Repaso' : 'Review')));
    
    if (exam.studyMaterials && exam.studyMaterials.length > 0) {
      const totalMaterialHours = exam.studyMaterials.reduce((sum, c) => sum + (c.user_estimated_total_hours || 0), 0);
      const completedHoursForExam = (inputs as any).completed_hours ? ((inputs as any).completed_hours[exam.id] || 0) : 0;
      
      let remainingRatio = 1.0;
      if (totalMaterialHours > 0 && completedHoursForExam > 0) {
        remainingRatio = Math.max(0, (totalMaterialHours - completedHoursForExam) / totalMaterialHours);
      }

      if (remainingRatio > 0) {
        const targetSessionMins = Math.min(90, Math.max(30, inputs.session_duration || 45)); // e.g. 30, 45, 60 mins
        // For users wanting ~60m sessions, allow chapters up to 1.5h (90m) to be studied in a single session
        // rather than artificially splitting a 1.5h chapter into two 45m micro-sessions.
        const splitThreshold = targetSessionMins >= 60 ? targetSessionMins * 1.55 : targetSessionMins * 1.33;

        for (const c of exam.studyMaterials) {
          const totalChapterMins = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60 * remainingRatio));
          
          if (totalChapterMins <= splitThreshold) {
            // Fits in 1 single session
            blocks.push({
              content: c.chapter,
              durationMinutes: Math.min(90, totalChapterMins)
            });
          } else {
            // Split into digestible chunks around targetSessionMins
            const numChunks = Math.max(2, Math.ceil(totalChapterMins / targetSessionMins));
            const chunkDuration = Math.min(90, Math.max(30, Math.round(totalChapterMins / numChunks)));
            for (let chunkIdx = 1; chunkIdx <= numChunks; chunkIdx++) {
              blocks.push({
                content: numChunks > 1 ? `${c.chapter} (${partWord} ${chunkIdx}/${numChunks})` : c.chapter,
                durationMinutes: chunkDuration
              });
            }
          }
        }
      }
    }

    // Failsafe: If all primary material hours are completed or no materials exist,
    // generate Review & Practice sessions so active exams NEVER have 0 upcoming sessions.
    if (blocks.length === 0) {
      const fallbackSessionDuration = Math.min(90, Math.max(30, inputs.session_duration || 45));
      if (exam.studyMaterials && exam.studyMaterials.length > 0) {
        for (const c of exam.studyMaterials) {
          blocks.push({
            content: c.chapter,
            durationMinutes: fallbackSessionDuration
          });
        }
      } else {
        const neededHours = Math.max(1, exam.totalHours || 2);
        for (let i = 0; i < neededHours; i++) {
          blocks.push({
            content: `${reviewWord}: ${exam.subject} ${partWord} ${i + 1}`,
            durationMinutes: fallbackSessionDuration
          });
        }
      }
    }



    // Guarantee that every exam ALWAYS has a dedicated final Revision session
    const hasExplicitReview = blocks.some(b => 
      isDedicatedReviewBlock(b.content)
    );
    if (!hasExplicitReview) {
      const fallbackSessionDuration = Math.min(90, Math.max(30, inputs.session_duration || 60));
      blocks.push({
        content: isDutch ? `Eindherhaling & Proeftoets: ${exam.subject}` : `Final Revision & Practice: ${exam.subject}`,
        durationMinutes: fallbackSessionDuration
      });
    }

    examTopics.set(exam.id, blocks);
  }

  const MAX_MINUTES_PER_DAY = inputs.allowOverload ? 24 * 60 : (inputs.daily_max_hours || 4) * 60;
  const PREFERRED_MINUTES_PER_DAY = inputs.allowOverload 
    ? 24 * 60 
    : Math.min(MAX_MINUTES_PER_DAY, Math.max(30, (inputs.soft_daily_limit || 2) * 60));

  const finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
  const dailyLoadMinutes = new Map<string, number>();
  const dailySessionsCount = new Map<string, number>();
  const examScheduledDays = new Map<string, Set<string>>();

  for (const d of availableDates) {
    dailyLoadMinutes.set(d, 0);
    dailySessionsCount.set(d, 0);
  }
  let wasOverloadedGlobally = false;

  // Sort exams by date ascending. Urgent exams get first pick of their valid days.
  const sortedExams = [...inputs.exams].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  // Map each pre-exam date (the day before an exam) to the exam IDs that take place the next day.
  // The day before an exam should preferably ONLY have sessions for tomorrow's exam(s).
  const preExamMap = new Map<string, Set<string>>();
  for (const exam of sortedExams) {
    const dayBefore = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
    if (!preExamMap.has(dayBefore)) {
      preExamMap.set(dayBefore, new Set<string>());
    }
    preExamMap.get(dayBefore)!.add(exam.id);
  }

  // Prepare valid dates and unassigned topics per exam
  const examValidDates = new Map<string, { allValid: string[]; horizonDates: string[] }>();
  const unassignedTopicsByExam = new Map<string, SessionBlock[]>();
  const examTargetDates = new Map<string, string[]>();

  // Maximum days before an exam to start active preparation (e.g. 21 days = 3 weeks)
  const MAX_HORIZON_DAYS = 21;

  for (const exam of sortedExams) {
    const rawTopics = examTopics.get(exam.id) || [];
    if (rawTopics.length === 0) continue;

    const lastValidDay = exam.can_study_after_exam
      ? exam.exam_date.toISOString().split('T')[0]
      : new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];

    let allValid = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
    if (allValid.length === 0 && availableDates.length > 0) {
      allValid = [availableDates[0]];
    }
    if (allValid.length === 0) continue;

    const totalTopicMins = rawTopics.reduce((sum, t) => sum + t.durationMinutes, 0);
    const minDaysNeeded = Math.ceil(totalTopicMins / PREFERRED_MINUTES_PER_DAY);
    // Active horizon: at least minDaysNeeded, up to MAX_HORIZON_DAYS or allValid length
    const horizonCount = Math.max(minDaysNeeded, Math.min(allValid.length, MAX_HORIZON_DAYS));
    const horizonDates = allValid.slice(-horizonCount);

    examValidDates.set(exam.id, { allValid, horizonDates });
    unassignedTopicsByExam.set(exam.id, [...rawTopics]);
    examTargetDates.set(exam.id, []);
    examScheduledDays.set(exam.id, new Set<string>());
  }

  // Pass 1: Reserve dedicated final review on the day before the exam for each exam
  for (const exam of sortedExams) {
    const topics = unassignedTopicsByExam.get(exam.id);
    const dateInfo = examValidDates.get(exam.id);
    if (!topics || !dateInfo || topics.length === 0) continue;

    const dayBeforeExam = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
    if (dateInfo.allValid.includes(dayBeforeExam)) {
      // Find the revision topic (or last topic)
      const reviewIdx = topics.findIndex(t => 
        isDedicatedReviewBlock(t.content)
      );
      const reviewTopic = reviewIdx !== -1 ? topics.splice(reviewIdx, 1)[0] : topics.pop()!;
      examTargetDates.get(exam.id)!.push(dayBeforeExam);
      dailyLoadMinutes.set(dayBeforeExam, (dailyLoadMinutes.get(dayBeforeExam) || 0) + reviewTopic.durationMinutes);
      dailySessionsCount.set(dayBeforeExam, (dailySessionsCount.get(dayBeforeExam) || 0) + 1);
      examScheduledDays.get(exam.id)!.add(dayBeforeExam);
    }
  }

  // Pass 2: Workload-Aware Interleaved Placement across all exams
  // Round-robin placement ensures subjects are studied in a balanced manner across available days
  // while strictly staying under PREFERRED_MINUTES_PER_DAY (e.g. 1 hour/day) whenever possible.
  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    for (const exam of sortedExams) {
      const topics = unassignedTopicsByExam.get(exam.id);
      const dateInfo = examValidDates.get(exam.id);
      if (!topics || !dateInfo || topics.length === 0) continue;
      hasRemaining = true;

      const topic = topics.pop()!;
      const duration = topic.durationMinutes;
      const { allValid, horizonDates } = dateInfo;

      let bestDay: string | null = null;
      let minScore = Infinity;

      const candidatePool = horizonDates.length > 0 ? horizonDates : allValid;

      // Iterate backwards so upcoming exams take precedence near their dates, leaving earlier slots balanced
      for (let i = candidatePool.length - 1; i >= 0; i--) {
        const d = candidatePool[i];
        const count = dailySessionsCount.get(d) || 0;
        const load = dailyLoadMinutes.get(d) || 0;
        const hasSame = examScheduledDays.get(exam.id)?.has(d) ? 1 : 0;
        const wouldExceedPref = (load + duration > PREFERRED_MINUTES_PER_DAY) ? 1 : 0;
        const wouldExceedMax = (load + duration > MAX_MINUTES_PER_DAY) ? 1 : 0;
        const isPreExamDayForOther = preExamMap.has(d) && !preExamMap.get(d)!.has(exam.id) ? 1 : 0;

        // Score priorities:
        // 1. Exceeding MAX is highest penalty
        // 2. Pre-exam day for another exam is heavily penalized (reserved exclusively for tomorrow's exam)
        // 3. Exceeding PREFERRED (soft limit, e.g. 1 hour) is next penalty
        // 4. Days with fewer sessions are heavily preferred (0 sessions > 1 session > 2 sessions)
        // 5. Days without this same exam are preferred to spread subjects
        // 6. Lowest existing load breaks ties
        const score = wouldExceedMax * 100000 + isPreExamDayForOther * 20000 + wouldExceedPref * 10000 + count * 1000 + hasSame * 500 + load;
        if (score < minScore) {
          minScore = score;
          bestDay = d;
        }
      }

      // Fallback: if all candidatePool dates exceed MAX and allValid has more dates
      if ((minScore >= 100000 || !bestDay) && allValid.length > candidatePool.length) {
        for (let i = allValid.length - 1; i >= 0; i--) {
          const d = allValid[i];
          const count = dailySessionsCount.get(d) || 0;
          const load = dailyLoadMinutes.get(d) || 0;
          const hasSame = examScheduledDays.get(exam.id)?.has(d) ? 1 : 0;
          const wouldExceedPref = (load + duration > PREFERRED_MINUTES_PER_DAY) ? 1 : 0;
          const wouldExceedMax = (load + duration > MAX_MINUTES_PER_DAY) ? 1 : 0;
          const isPreExamDayForOther = preExamMap.has(d) && !preExamMap.get(d)!.has(exam.id) ? 1 : 0;

          const score = wouldExceedMax * 100000 + isPreExamDayForOther * 20000 + wouldExceedPref * 10000 + count * 1000 + hasSame * 500 + load;
          if (score < minScore) {
            minScore = score;
            bestDay = d;
          }
        }
      }

      if (!bestDay) {
        bestDay = candidatePool[0] || allValid[0];
      }

      examTargetDates.get(exam.id)!.push(bestDay);
      dailySessionsCount.set(bestDay, (dailySessionsCount.get(bestDay) || 0) + 1);
      dailyLoadMinutes.set(bestDay, (dailyLoadMinutes.get(bestDay) || 0) + duration);
      examScheduledDays.get(exam.id)!.add(bestDay);
      if (dailyLoadMinutes.get(bestDay)! > MAX_MINUTES_PER_DAY) {
        wasOverloadedGlobally = true;
      }
    }
  }

  // Sort target dates chronologically per exam and place topics onto finalSchedule
  for (const exam of sortedExams) {
    const dates = examTargetDates.get(exam.id) || [];
    const origTopics = examTopics.get(exam.id) || [];
    dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    for (let i = 0; i < origTopics.length; i++) {
      const dateStr = dates[i];
      if (!finalSchedule.has(dateStr)) finalSchedule.set(dateStr, new Map());
      const dayMap = finalSchedule.get(dateStr)!;
      if (!dayMap.has(exam.id)) dayMap.set(exam.id, []);
      dayMap.get(exam.id)!.push(origTopics[i]);
    }
  }

  // Check if any day exceeded MAX_MINUTES_PER_DAY
  if (!inputs.allowOverload) {
    for (const [dateStr, totalMins] of Array.from(dailyLoadMinutes.entries())) {
      if (totalMins > MAX_MINUTES_PER_DAY) {
        wasOverloadedGlobally = true;
        break;
      }
    }
  }

  return { schedule: finalSchedule, wasOverloaded: wasOverloadedGlobally };
}

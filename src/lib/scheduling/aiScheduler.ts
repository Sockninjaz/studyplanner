import { resolveStudyLanguage } from '@/lib/i18n/resolveStudyLanguage';

export interface ExamInput {
  id: string;
  subject: string;
  exam_date: Date;
  totalHours: number;
  can_study_after_exam?: boolean;
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
        const targetSessionMins = Math.min(75, Math.max(30, inputs.session_duration || 50)); // typically 45-60 min
        // Keep individual session durations balanced around targetSessionMins.
        // Chapters up to 75m fit in 1 single session.
        // Larger chapters (> 75m, like 90m or 120m) are split into digestible chunks of ~45-60 min,
        // so that a day with 2 sessions never ends up at 180 min (3 hours).
        const splitThreshold = Math.min(75, Math.round(targetSessionMins * 1.25));

        for (const c of exam.studyMaterials) {
          const totalChapterMins = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60 * remainingRatio));
          
          if (totalChapterMins <= splitThreshold) {
            // Fits in 1 single session
            blocks.push({
              content: c.chapter,
              durationMinutes: Math.min(75, totalChapterMins)
            });
          } else {
            // Split into digestible chunks around targetSessionMins
            const numChunks = Math.max(2, Math.ceil(totalChapterMins / targetSessionMins));
            const chunkDuration = Math.min(75, Math.max(30, Math.round(totalChapterMins / numChunks / 5) * 5));
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



    // Ensure the final session before the exam covers final revision & practice,
    // WITHOUT adding an unbudgeted extra session that exceeds the total study hours
    // the user agreed upon in exam creation (e.g. turning 4.5h into 5.5h).
    const hasExplicitReview = blocks.some(b => 
      isDedicatedReviewBlock(b.content)
    );
    if (!hasExplicitReview && blocks.length >= 2) {
      const lastBlock = blocks[blocks.length - 1];
      lastBlock.content = isDutch
        ? `Eindherhaling & Proeftoets: ${exam.subject} (${lastBlock.content})`
        : `Final Revision & Practice: ${exam.subject} (${lastBlock.content})`;
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

  // Map each pre-exam date to exam IDs taking place 1 and 2 days later.
  // 1-day before: Exclusive pre-exam day (strictly dedicated to tomorrow's exam)
  // 2-days before: High-priority pre-exam crunch zone (protected from distant exams)
  const preExam1DayMap = new Map<string, Set<string>>();
  const preExam2DayMap = new Map<string, Set<string>>();

  for (const exam of sortedExams) {
    const dayBefore = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
    const twoDaysBefore = new Date(new Date(exam.exam_date).getTime() - 2 * 86400000).toISOString().split('T')[0];

    if (!preExam1DayMap.has(dayBefore)) preExam1DayMap.set(dayBefore, new Set<string>());
    preExam1DayMap.get(dayBefore)!.add(exam.id);

    if (!preExam2DayMap.has(twoDaysBefore)) preExam2DayMap.set(twoDaysBefore, new Set<string>());
    preExam2DayMap.get(twoDaysBefore)!.add(exam.id);
  }

  // Prepare valid dates and unassigned topics per exam
  const examValidDates = new Map<string, { allValid: string[]; horizonDates: string[]; postPriorDays?: string[]; firstAvailablePostDay?: string }>();
  const unassignedTopicsByExam = new Map<string, SessionBlock[]>();
  const examTargetDates = new Map<string, string[]>();

  for (const exam of sortedExams) {
    const rawTopics = examTopics.get(exam.id) || [];
    if (rawTopics.length === 0) continue;

    // Study for an exam always concludes on or before the day before the exam.
    // The exam date itself is reserved for the exam; its afternoon is only available for FUTURE exams.
    const lastValidDay = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];

    let allValid = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
    if (allValid.length === 0 && availableDates.length > 0) {
      allValid = [availableDates[0]];
    }
    if (allValid.length === 0) continue;

    const totalTopicMins = rawTopics.reduce((sum, t) => sum + t.durationMinutes, 0);
    const minDaysNeeded = Math.ceil(totalTopicMins / PREFERRED_MINUTES_PER_DAY);

    // --- EXAM ISOLATION CHECK (Sequential Focus) ---
    // If there is an earlier exam, check if this exam can be completely isolated
    // to the window between the earlier exam and this exam.
    // e.g. German on Nov 12 with Math on Nov 10: if German can fit in Nov 10-11,
    // isolate German exclusively to Nov 10-11 so it does not crowd Math or Dutch.
    const thisExamDateStr = exam.exam_date.toISOString().split('T')[0];
    const earlierExams = sortedExams.filter(e => {
      const eDateStr = e.exam_date.toISOString().split('T')[0];
      return eDateStr < thisExamDateStr;
    });

    let isIsolated = false;
    let postPriorDays: string[] = [];
    let firstAvailablePostDay: string | undefined;

    if (earlierExams.length > 0) {
      const closestEarlierExam = earlierExams[earlierExams.length - 1];
      const earlierDateStr = closestEarlierExam.exam_date.toISOString().split('T')[0];

      // If user can study after the earlier exam, that afternoon/evening is available for study
      firstAvailablePostDay = closestEarlierExam.can_study_after_exam !== false
        ? earlierDateStr
        : new Date(new Date(closestEarlierExam.exam_date).getTime() + 86400000).toISOString().split('T')[0];

      postPriorDays = allValid.filter(d => d >= firstAvailablePostDay! && d <= lastValidDay);

      if (postPriorDays.length > 0) {
        // Calculate capacity in postPriorDays:
        // Full pre-exam days (e.g. day before exam) comfortably accommodate 2 sessions (up to 120-135m).
        // Exam day afternoons accommodate 1-2 sessions (up to 90-120m).
        const postSessionCapacity = postPriorDays.reduce((acc, d) => {
          return acc + (d === earlierDateStr ? 3 : 3);
        }, 0);

        const postMinsCapacity = postPriorDays.reduce((acc, d) => {
          return acc + (d === earlierDateStr ? 135 : Math.max(150, PREFERRED_MINUTES_PER_DAY + 30));
        }, 0);

        // If sessions fit in postPriorDays within healthy capacity, ISOLATE 100%!
        if (rawTopics.length <= postSessionCapacity && totalTopicMins <= postMinsCapacity) {
          isIsolated = true;
          allValid = postPriorDays;
        }
      }
    }

    let horizonDates: string[];
    if (isIsolated) {
      horizonDates = [...allValid];
    } else {
      const targetHorizonDays = Math.max(minDaysNeeded + 1, Math.ceil(rawTopics.length * 2.0));
      const horizonCount = Math.max(minDaysNeeded, Math.min(allValid.length, targetHorizonDays));
      horizonDates = allValid.slice(-horizonCount);
    }

    examValidDates.set(exam.id, { allValid, horizonDates, postPriorDays, firstAvailablePostDay });
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
      const reviewIdx = topics.findIndex(t => isDedicatedReviewBlock(t.content));
      const reviewTopic = reviewIdx !== -1 ? topics.splice(reviewIdx, 1)[0] : topics.pop()!;
      examTargetDates.get(exam.id)!.push(dayBeforeExam);
      dailyLoadMinutes.set(dayBeforeExam, (dailyLoadMinutes.get(dayBeforeExam) || 0) + reviewTopic.durationMinutes);
      dailySessionsCount.set(dayBeforeExam, (dailySessionsCount.get(dayBeforeExam) || 0) + 1);
      examScheduledDays.get(exam.id)!.add(dayBeforeExam);
    }
  }

  // Pass 2: Workload-Aware Interleaved Placement across all exams
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
      const { allValid, horizonDates, postPriorDays, firstAvailablePostDay } = dateInfo;

      let bestDay: string | null = null;
      let minScore = Infinity;

      const candidatePool = horizonDates.length > 0 ? horizonDates : allValid;
      const scheduledList = Array.from(examScheduledDays.get(exam.id) || []);

      // Check if postPriorDays still has capacity:
      const postDaysAvailable = postPriorDays && postPriorDays.length > 0;
      const postDaysHaveCapacity = postDaysAvailable && postPriorDays.some(pd => {
        const curCount = dailySessionsCount.get(pd) || 0;
        const curLoad = dailyLoadMinutes.get(pd) || 0;
        const maxDayCount = 3;
        const maxDayLoad = (pd === firstAvailablePostDay) ? 135 : Math.max(150, PREFERRED_MINUTES_PER_DAY + 30);
        return curCount < maxDayCount && (curLoad + duration <= maxDayLoad);
      });

      for (let i = candidatePool.length - 1; i >= 0; i--) {
        const d = candidatePool[i];
        const count = dailySessionsCount.get(d) || 0;
        const load = dailyLoadMinutes.get(d) || 0;
        const hasSame = examScheduledDays.get(exam.id)?.has(d) ? 1 : 0;
        const wouldExceedMax = (load + duration > MAX_MINUTES_PER_DAY) ? 1 : 0;

        const isPreExam1ForThis = preExam1DayMap.has(d) && preExam1DayMap.get(d)!.has(exam.id);
        const isPreExam1ForOther = preExam1DayMap.has(d) && !preExam1DayMap.get(d)!.has(exam.id);

        const daysBeforeExam = Math.max(1, Math.round((new Date(exam.exam_date).getTime() - new Date(d).getTime()) / 86400000));
        const isPreExam2ForOther = preExam2DayMap.has(d) && !preExam2DayMap.get(d)!.has(exam.id) && daysBeforeExam > 2;

        // Recency penalty: prioritize dates closer to the exam date
        const recencyPenalty = daysBeforeExam * 220;

        // Count penalty:
        // On pre-exam days or near exam (<= 2 days), a 2nd session is completely natural and welcome
        let countPenalty = 0;
        if (count === 1) {
          if (daysBeforeExam <= 2 || isPreExam1ForThis) {
            countPenalty = 0; // Welcome 2nd session near exam
          } else if (daysBeforeExam <= 4) {
            countPenalty = 150;
          } else {
            countPenalty = 450;
          }
        } else if (count >= 2) {
          if (load + duration <= PREFERRED_MINUTES_PER_DAY) {
            countPenalty = 300 * count;
          } else {
            countPenalty = 1500 * count;
          }
        }

        // Same exam penalty:
        // Welcome multiple sessions of the same subject on days right before the exam
        let sameExamPenalty = 0;
        if (hasSame) {
          if (daysBeforeExam <= 2 || isPreExam1ForThis) {
            sameExamPenalty = 0;
          } else {
            sameExamPenalty = 300;
          }
        }

        // Retention gap penalty
        let gapPenalty = 0;
        if (scheduledList.length > 0) {
          const minGap = Math.min(
            ...scheduledList.map(sd =>
              Math.abs(Math.round((new Date(d).getTime() - new Date(sd).getTime()) / 86400000))
            )
          );
          if (minGap > 4) {
            gapPenalty = (minGap - 4) * 1000;
          }
        }

        // Check session length: prevent two long sessions (>= 65m) on the same day
        const hasExistingLong = (count > 0 && Math.round(load / count) >= 65);
        const wouldDoubleLong = (hasExistingLong && duration >= 65) ? 1 : 0;

        // Overload penalty:
        // Strongly penalize days exceeding 135 mins, strictly forbid 160+ mins (prevents 180m days)
        let overloadPenalty = 0;
        if (load + duration > 160) {
          overloadPenalty = 100000;
        } else if (load + duration > 135) {
          overloadPenalty = 25000;
        } else if (load + duration > PREFERRED_MINUTES_PER_DAY) {
          overloadPenalty = 6000 + (load + duration - PREFERRED_MINUTES_PER_DAY) * 100;
        }

        // Spillover penalty: if post-prior gap days still have capacity, strictly forbid spilling before the prior exam
        let prePriorPenalty = 0;
        if (postDaysHaveCapacity && firstAvailablePostDay && d < firstAvailablePostDay) {
          prePriorPenalty = 100000;
        }

        const score =
          wouldExceedMax * 100000 +
          (isPreExam1ForOther ? 100000 : 0) +
          (isPreExam2ForOther ? 40000 : 0) +
          prePriorPenalty +
          wouldDoubleLong * 90000 +
          overloadPenalty +
          recencyPenalty +
          countPenalty +
          sameExamPenalty +
          gapPenalty +
          Math.round(load / 10);

        if (score < minScore) {
          minScore = score;
          bestDay = d;
        }
      }

      // Fallback if all candidatePool dates exceed MAX or cause heavy overload
      if ((minScore >= 80000 || !bestDay) && allValid.length > candidatePool.length) {
        for (let i = allValid.length - 1; i >= 0; i--) {
          const d = allValid[i];
          const count = dailySessionsCount.get(d) || 0;
          const load = dailyLoadMinutes.get(d) || 0;
          const hasSame = examScheduledDays.get(exam.id)?.has(d) ? 1 : 0;
          const wouldExceedMax = (load + duration > MAX_MINUTES_PER_DAY) ? 1 : 0;
          const isPreExam1ForOther = preExam1DayMap.has(d) && !preExam1DayMap.get(d)!.has(exam.id);
          const daysBeforeExam = Math.max(1, Math.round((new Date(exam.exam_date).getTime() - new Date(d).getTime()) / 86400000));

          let fbOverload = 0;
          if (load + duration > 160) fbOverload = 100000;
          else if (load + duration > 135) fbOverload = 25000;
          else if (load + duration > PREFERRED_MINUTES_PER_DAY) fbOverload = 6000;

          const score =
            wouldExceedMax * 100000 +
            (isPreExam1ForOther ? 100000 : 0) +
            fbOverload +
            daysBeforeExam * 200 +
            count * 400 +
            hasSame * 200 +
            load;

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

  // === PASS 3: WORKLOAD LEVELING & DAILY LOAD SMOOTHING ===
  // Eliminates 3-hour / 3-session crunch days by moving sessions to lighter days
  // where valid, ensuring a smooth ±1 session distribution across active study days.
  interface ScheduledItem {
    examId: string;
    topicIndex: number;
    durationMinutes: number;
    isReview: boolean;
    dateStr: string;
  }

  const scheduledItems: ScheduledItem[] = [];
  for (const exam of sortedExams) {
    const dates = examTargetDates.get(exam.id) || [];
    const origTopics = examTopics.get(exam.id) || [];
    for (let i = 0; i < origTopics.length; i++) {
      scheduledItems.push({
        examId: exam.id,
        topicIndex: i,
        durationMinutes: origTopics[i].durationMinutes,
        isReview: isDedicatedReviewBlock(origTopics[i].content),
        dateStr: dates[i],
      });
    }
  }

  const getDayItems = (d: string) => scheduledItems.filter(it => it.dateStr === d);
  const getDayLoad = (d: string) => getDayItems(d).reduce((sum, it) => sum + it.durationMinutes, 0);
  const getDayCount = (d: string) => getDayItems(d).length;

  const totalStudyMinutes = scheduledItems.reduce((sum, it) => sum + it.durationMinutes, 0);
  const activeDaysList = availableDates.filter(d => getDayCount(d) > 0);
  const avgDailyMins = Math.round(totalStudyMinutes / Math.max(1, activeDaysList.length));

  const MAX_LEVELING_ITERATIONS = 50;
  for (let iter = 0; iter < MAX_LEVELING_ITERATIONS; iter++) {
    // Identify heavy days (> 135 mins, or >= 3 sessions, or significantly above average daily load)
    const heavyDays = availableDates
      .filter(d => {
        const c = getDayCount(d);
        const l = getDayLoad(d);
        return c >= 3 || l > Math.max(135, avgDailyMins + 20);
      })
      .sort((a, b) => {
        const loadDiff = getDayLoad(b) - getDayLoad(a);
        if (loadDiff !== 0) return loadDiff;
        return getDayCount(b) - getDayCount(a);
      });

    if (heavyDays.length === 0) break;

    let moveMade = false;

    for (const heavyDay of heavyDays) {
      const heavyLoad = getDayLoad(heavyDay);
      const heavyCount = getDayCount(heavyDay);
      // Dedicated review sessions on the day before the exam remain fixed
      const donorItems = getDayItems(heavyDay).filter(it => !it.isReview);

      if (donorItems.length === 0) continue;

      for (const item of donorItems) {
        const dur = item.durationMinutes;
        const examDatesInfo = examValidDates.get(item.examId);
        if (!examDatesInfo) continue;
        const validDates = examDatesInfo.allValid;

        let bestTargetDay: string | null = null;
        let bestTargetScore = Infinity;

        for (const targetDay of validDates) {
          if (targetDay === heavyDay) continue;
          if (blockedSet.has(targetDay)) continue;

          // Never invade exclusive pre-exam day of another exam
          if (preExam1DayMap.has(targetDay) && !preExam1DayMap.get(targetDay)!.has(item.examId)) {
            continue;
          }

          const targetLoad = getDayLoad(targetDay);
          const targetCount = getDayCount(targetDay);

          // Capacity check on target day:
          // Target day cannot exceed daily max or become a new heavy day (> 135m, or > 150m on dedicated pre-exam day)
          if (targetLoad + dur > MAX_MINUTES_PER_DAY) continue;
          const maxTargetLoad = (preExam1DayMap.has(targetDay) && preExam1DayMap.get(targetDay)!.has(item.examId)) ? 150 : 135;
          if (targetLoad + dur > maxTargetLoad) continue;
          if (targetCount >= 2 && targetLoad + dur > PREFERRED_MINUTES_PER_DAY && !preExam1DayMap.has(targetDay)) continue;
          const maxTargetCount = (preExam1DayMap.has(targetDay) && preExam1DayMap.get(targetDay)!.has(item.examId)) ? 3 : 2;
          if (targetCount >= maxTargetCount) continue;

          // Must strictly reduce the minute disparity between heavyDay and targetDay
          const currentDiff = heavyLoad - targetLoad;
          const newDiff = Math.abs((heavyLoad - dur) - (targetLoad + dur));
          if (newDiff >= currentDiff) continue;

          // Prefer target days closer to avgDailyMins and earlier in time for better prep
          const isEarlier = targetDay < heavyDay;
          const distToAvg = Math.abs((targetLoad + dur) - avgDailyMins);
          const targetScore = distToAvg + (isEarlier ? 0 : 40) + targetCount * 15;

          if (targetScore < bestTargetScore) {
            bestTargetScore = targetScore;
            bestTargetDay = targetDay;
          }
        }

        if (bestTargetDay) {
          item.dateStr = bestTargetDay;
          moveMade = true;
          break;
        }
      }

      if (moveMade) break;
    }

    if (!moveMade) break;
  }

  // Update target dates from leveled items
  for (const item of scheduledItems) {
    const dates = examTargetDates.get(item.examId);
    if (dates) {
      dates[item.topicIndex] = item.dateStr;
    }
  }

  // Re-calculate daily stats accurately after leveling
  dailyLoadMinutes.clear();
  dailySessionsCount.clear();
  for (const d of availableDates) {
    dailyLoadMinutes.set(d, 0);
    dailySessionsCount.set(d, 0);
  }
  for (const item of scheduledItems) {
    dailyLoadMinutes.set(item.dateStr, (dailyLoadMinutes.get(item.dateStr) || 0) + item.durationMinutes);
    dailySessionsCount.set(item.dateStr, (dailySessionsCount.get(item.dateStr) || 0) + 1);
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

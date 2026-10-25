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
    completed?: boolean;
  }>;
}

export interface CompletedSessionInfo {
  examId: string;
  title?: string;
  shortTitle?: string;
  durationMinutes?: number;
}

export interface AISchedulerInputs {
  exams: ExamInput[];
  daily_max_hours: number;
  soft_daily_limit: number;
  session_duration: number; // minutes
  start_date: Date;
  blocked_days?: string[];
  existing_sessions?: { examId: string; content: string }[];
  completed_sessions?: CompletedSessionInfo[];
  allowOverload?: boolean;
  userProfile?: any;
}

export interface SessionBlock {
  content: string;
  durationMinutes: number;
}

export function normalizeSessionContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/^(?:studeren|study|lernen|étudier|estudiar):\s*(?:[^-]+-\s*)?/i, '')
    .toLowerCase()
    .replace(/[`'"]/g, '')
    .replace(/[\s\t\n]+/g, ' ')
    .trim();
}

export function extractChapterBase(text: string): string {
  if (!text) return '';
  const withoutPart = text.replace(/\s*\((?:deel|part|teil|partie|parte)\s*\d+\/\d+\)\s*$/i, '');
  return normalizeSessionContent(withoutPart);
}

export function isChapterMatch(chapterA: string, chapterB: string): boolean {
  const baseA = extractChapterBase(chapterA);
  const baseB = extractChapterBase(chapterB);
  if (!baseA || !baseB) return false;
  if (baseA === baseB) return true;

  // Check if both start with same chapter number, e.g. "h12" or "h1"
  const matchA = baseA.match(/^h\s*(\d+[a-z]?)\b/i);
  const matchB = baseB.match(/^h\s*(\d+[a-z]?)\b/i);
  if (matchA && matchB) {
    if (matchA[1].toLowerCase() !== matchB[1].toLowerCase()) {
      return false; // Different chapter numbers (e.g. H1 vs H10 or H12 vs H13)
    }
    // Same chapter number (e.g. both H12)
    return true;
  }

  // Fallback: If one is a complete substring of the other and at least 8 characters long
  if (baseA.length >= 8 && baseB.length >= 8) {
    if (baseA.includes(baseB) || baseB.includes(baseA)) return true;
  }

  return false;
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
    
    const completedForExam = (inputs.completed_sessions || []).filter(
      s => s.examId === exam.id
    );

    if (exam.studyMaterials && exam.studyMaterials.length > 0) {
      // Filter out chapters explicitly marked completed if active chapters remain
      const activeMaterials = exam.studyMaterials.filter(c => !c.completed);
      const materialsToSchedule = activeMaterials.length > 0 ? activeMaterials : exam.studyMaterials;

      const targetSessionMins = Math.min(75, Math.max(30, inputs.session_duration || 50)); // typically 45-60 min
      // Keep individual session durations balanced around targetSessionMins.
      // Chapters up to 75m fit in 1 single session.
      // Larger chapters (> 75m, like 90m or 120m) are split into digestible chunks of ~45-60 min,
      // so that a day with 2 sessions never ends up at 180 min (3 hours).
      const splitThreshold = Math.min(75, Math.round(targetSessionMins * 1.25));

      for (const c of materialsToSchedule) {
        const matchingCompleted = completedForExam.filter(cs => 
          isChapterMatch(c.chapter, cs.shortTitle || cs.title || '')
        );

        const totalChapterMins = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60));
        const completedMinsForMat = matchingCompleted.reduce(
          (sum, cs) => sum + (cs.durationMinutes || 60),
          0
        );

        const numChunks = totalChapterMins <= splitThreshold ? 1 : Math.max(2, Math.ceil(totalChapterMins / targetSessionMins));

        // Extract completed parts
        const completedParts = new Set<number>();
        let hasPartTags = false;
        for (const cs of matchingCompleted) {
          const text = cs.shortTitle || cs.title || '';
          const match = text.match(/\((?:deel|part|teil|partie|parte)\s*(\d+)\/\d+\)/i);
          if (match) {
            completedParts.add(parseInt(match[1], 10));
            hasPartTags = true;
          }
        }

        const isEntireChapterDone =
          (hasPartTags && completedParts.size >= numChunks) ||
          completedMinsForMat >= totalChapterMins ||
          (!hasPartTags && matchingCompleted.length >= numChunks);

        if (isEntireChapterDone) {
          // Chapter has already been finished by user — never duplicate into future schedule!
          continue;
        }

        if (numChunks === 1) {
          blocks.push({
            content: c.chapter,
            durationMinutes: totalChapterMins
          });
        } else {
          // Split into digestible chunks around targetSessionMins that sum exactly to totalChapterMins
          const baseChunk = Math.floor(totalChapterMins / numChunks / 5) * 5;
          let remainder = totalChapterMins - (baseChunk * numChunks);
          for (let chunkIdx = 1; chunkIdx <= numChunks; chunkIdx++) {
            const addFive = remainder >= 5 ? 5 : 0;
            remainder -= addFive;
            const dur = Math.min(90, Math.max(30, baseChunk + addFive));
            const chunkContent = `${c.chapter} (${partWord} ${chunkIdx}/${numChunks})`;

            if (completedParts.has(chunkIdx) || (matchingCompleted.length >= chunkIdx && !hasPartTags)) {
              // This specific chunk was already completed — skip it!
              continue;
            }

            blocks.push({
              content: chunkContent,
              durationMinutes: dur
            });
          }
        }
      }
    }

    // Failsafe: If all primary material hours are completed or no materials exist,
    // generate Review & Practice sessions so active exams NEVER have 0 upcoming sessions.
    if (blocks.length === 0) {
      const fallbackSessionDuration = Math.min(90, Math.max(30, inputs.session_duration || 45));
      blocks.push({
        content: isDutch ? `Eindherhaling & Proeftoets: ${exam.subject}` : `Final Revision & Practice: ${exam.subject}`,
        durationMinutes: fallbackSessionDuration
      });
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

    // NOTE: The former hard "isolation" rule (cramming a trailing exam entirely into the days after
    // the previous exam) is gone. The global optimiser in Pass 3 now balances the workload across all
    // exams, which naturally lets a trailing exam use light days earlier on (e.g. the afternoon of an
    // earlier exam day) instead of piling everything into the last two days.
    const isIsolated = false;
    const postPriorDays: string[] = [];
    const firstAvailablePostDay: string | undefined = undefined;

    let horizonDates: string[];
    if (isIsolated) {
      horizonDates = [...allValid];
    } else {
      const targetHorizonDays = Math.max(minDaysNeeded + 1, Math.ceil(rawTopics.length * 2.0));
      const horizonCount = Math.max(minDaysNeeded, Math.min(allValid.length, targetHorizonDays));
      horizonDates = allValid.slice(-horizonCount);
    }

    const maxLeadDays = Math.max(7, Math.ceil(rawTopics.length * 1.6), Math.ceil(totalTopicMins / 60 * 1.6));
    if (!isIsolated && allValid.length > maxLeadDays) {
      const candidateLead = allValid.slice(-maxLeadDays);
      if (candidateLead.length * 2 >= rawTopics.length) {
        allValid = candidateLead;
        horizonDates = candidateLead;
      }
    }

    examValidDates.set(exam.id, { allValid, horizonDates, postPriorDays, firstAvailablePostDay });
    unassignedTopicsByExam.set(exam.id, [...rawTopics]);
    examTargetDates.set(exam.id, []);
    examScheduledDays.set(exam.id, new Set<string>());
  }

  // Pass 1: Reserve dedicated final review on the day before the exam for each exam
  const reservedReviewExams = new Set<string>();
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
      reservedReviewExams.add(exam.id);
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
          if (minGap > 3) {
            gapPenalty = (minGap - 3) * 25000;
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

  // === PASS 3: GLOBAL SCHEDULE OPTIMISATION ===
  // Pass 2 produces a reasonable first draft. Here we search (simulated annealing, seeded so it is
  // fully deterministic) for the arrangement of ALL sessions across ALL exams that minimises a
  // single cost function. This allows coordinated trades that greedy one-move leveling can never
  // find, e.g. "move a Math session back a day so a German session can take its old slot".
  //
  // The cost function encodes what makes a schedule feel good:
  //  - even daily workload (squared load) and no big jumps UP from one day to the next
  //    (a drop in workload towards the end is fine because fewer exams remain)
  //  - no crunch days (>135m, >2 sessions) and no empty days
  //  - sessions of the same exam are never separated by a huge gap
  //  - study stays reasonably close to the exam, protects the day(s) right before other exams
  //  - exam days stay light (only the afternoon is usable)
  const dayNumCache = new Map<string, number>();
  const dayNum = (d: string): number => {
    let n = dayNumCache.get(d);
    if (n === undefined) {
      n = Math.round(Date.parse(`${d}T00:00:00.000Z`) / 86400000);
      dayNumCache.set(d, n);
    }
    return n;
  };

  const examDayNums = new Map<string, number>();
  const examDaySet = new Set<string>();
  for (const exam of sortedExams) {
    const examDateStr = new Date(exam.exam_date).toISOString().split('T')[0];
    examDayNums.set(exam.id, dayNum(examDateStr));
    examDaySet.add(examDateStr);
  }

  const optExams = sortedExams.filter(
    e => (examTargetDates.get(e.id)?.length || 0) > 0 && examValidDates.has(e.id) && (examTopics.get(e.id)?.length || 0) > 0
  );

  const validDayArrays = new Map<string, string[]>();
  const validDaySets = new Map<string, Set<string>>();
  for (const exam of optExams) {
    const days = examValidDates.get(exam.id)!.allValid.filter(d => !blockedSet.has(d));
    validDayArrays.set(exam.id, days);
    validDaySets.set(exam.id, new Set(days));
  }

  const optState = new Map<string, string[]>();
  for (const exam of optExams) {
    optState.set(exam.id, [...examTargetDates.get(exam.id)!]);
  }

  const evaluateSchedule = (state: Map<string, string[]>): number => {
    const load = new Map<string, number>();
    const cnt = new Map<string, number>();
    const longCnt = new Map<string, number>();
    const sameCnt = new Map<string, number>();
    let cost = 0;

    for (const exam of optExams) {
      // Topics are placed chronologically (k-th topic on the k-th earliest date),
      // so durations must be zipped with the SORTED dates to get the true daily load.
      const dates = [...state.get(exam.id)!].sort();
      const topics = examTopics.get(exam.id)!;
      const examNum = examDayNums.get(exam.id)!;

      for (let i = 0; i < dates.length && i < topics.length; i++) {
        const d = dates[i];
        const dur = topics[i].durationMinutes;
        load.set(d, (load.get(d) || 0) + dur);
        cnt.set(d, (cnt.get(d) || 0) + 1);

        const daysBefore = Math.max(1, examNum - dayNum(d));
        cost += daysBefore * 4;

        const p1 = preExam1DayMap.get(d);
        if (p1 && !p1.has(exam.id)) cost += 4000;
        const p2 = preExam2DayMap.get(d);
        if (p2 && !p2.has(exam.id) && daysBefore > 2) cost += 60;

        if (dur >= 65) longCnt.set(d, (longCnt.get(d) || 0) + 1);
        if (daysBefore > 2) {
          const key = `${d}|${exam.id}`;
          const prior = sameCnt.get(key) || 0;
          if (prior >= 1) cost += 40;
          sameCnt.set(key, prior + 1);
        }

        if (i > 0) {
          const gap = dayNum(d) - dayNum(dates[i - 1]);
          if (gap > 3) cost += (gap - 3) * 400;
        }
      }
    }

    let lastActive = -1;
    for (let k = 0; k < availableDates.length; k++) {
      if ((cnt.get(availableDates[k]) || 0) > 0) lastActive = k;
    }

    // Wind-down = the last two active days (only the final exam is still ahead)
    const windDownStart = Math.max(0, lastActive - 1);
    const LIGHT_DAY_FLOOR = 90;
    let prevLoad = 0;
    for (let k = 0; k <= lastActive; k++) {
      const d = availableDates[k];
      const L = load.get(d) || 0;
      const C = cnt.get(d) || 0;
      const isExamDay = examDaySet.has(d);

      cost += (L * L) / 60;
      // Light days are only natural in the final wind-down (few exams left). Earlier on they mean the
      // work is badly distributed, so push study time onto them.
      if (k < windDownStart && L < LIGHT_DAY_FLOOR) cost += ((LIGHT_DAY_FLOOR - L) * (LIGHT_DAY_FLOOR - L)) / 3;
      if (L > MAX_MINUTES_PER_DAY) cost += (L - MAX_MINUTES_PER_DAY) * 500;
      if (L > 135) cost += (L - 135) * (L - 135) * 3;
      if (C > 2) cost += 600 * (C - 2);
      if ((longCnt.get(d) || 0) > 1) cost += 400 * ((longCnt.get(d) || 0) - 1);

      if (L === 0) cost += isExamDay ? 200 : 1500;
      if (isExamDay) {
        if (C > 2) cost += 400 * (C - 2);
        if (L > 90) cost += ((L - 90) * (L - 90)) / 8;
      }

      if (k > 0) {
        const rise = L - prevLoad;
        // Workload may fall towards the end (fewer exams left) but must not jump UP by > 1 hour
        if (rise > 60) cost += (rise - 60) * (rise - 60) * 2;
        cost += (rise * rise) / 150;
      }
      prevLoad = L;
    }

    return cost;
  };

  interface MovableItem { examId: string; idx: number }
  const movable: MovableItem[] = [];
  for (const exam of optExams) {
    const n = optState.get(exam.id)!.length;
    for (let idx = 0; idx < n; idx++) {
      // The reserved final review on the day before the exam stays fixed
      if (idx === 0 && reservedReviewExams.has(exam.id)) continue;
      movable.push({ examId: exam.id, idx });
    }
  }

  if (movable.length > 1) {
    let seed = 0x9e3779b9 ^ (movable.length * 2654435761);
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    let curCost = evaluateSchedule(optState);
    let bestCost = curCost;
    let bestState = new Map<string, string[]>();
    optState.forEach((v, k) => bestState.set(k, [...v]));

    const ITERATIONS = 25000;
    const T_START = 400;
    const T_END = 4;

    for (let it = 0; it < ITERATIONS; it++) {
      const temp = T_START * Math.pow(T_END / T_START, it / ITERATIONS);
      const a = movable[Math.floor(rand() * movable.length)];
      const aDates = optState.get(a.examId)!;
      const aOld = aDates[a.idx];

      let undo: () => void;

      if (rand() < 0.5) {
        // Relocate one session to another valid day
        const pool = validDayArrays.get(a.examId)!;
        if (pool.length === 0) continue;
        const target = pool[Math.floor(rand() * pool.length)];
        if (target === aOld) continue;
        aDates[a.idx] = target;
        undo = () => { aDates[a.idx] = aOld; };
      } else {
        // Swap days between two sessions of different exams
        const b = movable[Math.floor(rand() * movable.length)];
        if (b.examId === a.examId) continue;
        const bDates = optState.get(b.examId)!;
        const bOld = bDates[b.idx];
        if (aOld === bOld) continue;
        if (!validDaySets.get(a.examId)!.has(bOld) || !validDaySets.get(b.examId)!.has(aOld)) continue;
        aDates[a.idx] = bOld;
        bDates[b.idx] = aOld;
        undo = () => { aDates[a.idx] = aOld; bDates[b.idx] = bOld; };
      }

      const newCost = evaluateSchedule(optState);
      const delta = newCost - curCost;
      if (delta <= 0 || rand() < Math.exp(-delta / temp)) {
        curCost = newCost;
        if (curCost < bestCost - 1e-9) {
          bestCost = curCost;
          bestState = new Map<string, string[]>();
          optState.forEach((v, k) => bestState.set(k, [...v]));
        }
      } else {
        undo();
      }
    }

    bestState.forEach((dates, examId) => {
      examTargetDates.set(examId, dates);
    });
  }

  // Re-calculate daily stats accurately after optimisation (topics map onto chronologically sorted dates)
  dailyLoadMinutes.clear();
  dailySessionsCount.clear();
  for (const d of availableDates) {
    dailyLoadMinutes.set(d, 0);
    dailySessionsCount.set(d, 0);
  }
  for (const exam of sortedExams) {
    const dates = [...(examTargetDates.get(exam.id) || [])].sort();
    const origTopics = examTopics.get(exam.id) || [];
    for (let i = 0; i < origTopics.length && i < dates.length; i++) {
      dailyLoadMinutes.set(dates[i], (dailyLoadMinutes.get(dates[i]) || 0) + origTopics[i].durationMinutes);
      dailySessionsCount.set(dates[i], (dailySessionsCount.get(dates[i]) || 0) + 1);
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

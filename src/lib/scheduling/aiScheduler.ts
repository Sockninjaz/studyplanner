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
}

export interface SessionBlock {
  content: string;
  durationMinutes: number;
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
    
    if (exam.studyMaterials && exam.studyMaterials.length > 0) {
      const totalMaterialHours = exam.studyMaterials.reduce((sum, c) => sum + (c.user_estimated_total_hours || 0), 0);
      const completedHoursForExam = (inputs as any).completed_hours ? ((inputs as any).completed_hours[exam.id] || 0) : 0;
      
      let remainingRatio = 1.0;
      if (totalMaterialHours > 0 && completedHoursForExam > 0) {
        remainingRatio = Math.max(0, (totalMaterialHours - completedHoursForExam) / totalMaterialHours);
      }

      if (remainingRatio > 0) {
        const targetSessionMins = Math.min(90, Math.max(30, inputs.session_duration || 45)); // e.g. 30, 45, 60 mins

        for (const c of exam.studyMaterials) {
          const totalChapterMins = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60 * remainingRatio));
          
          if (totalChapterMins <= targetSessionMins * 1.33) {
            // Fits in 1 single session
            blocks.push({
              content: c.chapter,
              durationMinutes: totalChapterMins
            });
          } else {
            // Split into digestible chunks around targetSessionMins
            const numChunks = Math.ceil(totalChapterMins / targetSessionMins);
            const chunkDuration = Math.min(90, Math.max(30, Math.round(totalChapterMins / numChunks)));
            for (let chunkIdx = 1; chunkIdx <= numChunks; chunkIdx++) {
              blocks.push({
                content: numChunks > 1 ? `${c.chapter} (Deel ${chunkIdx}/${numChunks})` : c.chapter,
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
            content: `Review: ${c.chapter}`,
            durationMinutes: fallbackSessionDuration
          });
        }
      } else {
        const neededHours = Math.max(1, exam.totalHours || 2);
        for (let i = 0; i < neededHours; i++) {
          blocks.push({
            content: `Review: ${exam.subject} Part ${i + 1}`,
            durationMinutes: fallbackSessionDuration
          });
        }
      }
    }

    examTopics.set(exam.id, blocks);
  }

  const MAX_MINUTES_PER_DAY = inputs.allowOverload ? 24 * 60 : (inputs.daily_max_hours || 4) * 60;
  const PREFERRED_MINUTES_PER_DAY = inputs.allowOverload 
    ? 24 * 60 
    : Math.min(MAX_MINUTES_PER_DAY, Math.max(30, (inputs.soft_daily_limit || 2) * 60));

  const finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
  const dailyLoadMinutes = new Map<string, number>();
  for (const d of availableDates) {
    dailyLoadMinutes.set(d, 0);
  }
  let wasOverloadedGlobally = false;

  // Sort exams by date ascending. Urgent exams get first pick of their valid days.
  const sortedExams = [...inputs.exams].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  for (const exam of sortedExams) {
    const topics = examTopics.get(exam.id) || [];
    if (topics.length === 0) continue;

    const lastValidDay = exam.can_study_after_exam
      ? exam.exam_date.toISOString().split('T')[0]
      : new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];

    let validDatesForExam = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
    if (validDatesForExam.length === 0 && availableDates.length > 0) {
      validDatesForExam = [availableDates[0]];
    }
    if (validDatesForExam.length === 0) continue;

    const totalTopicMins = topics.reduce((sum, t) => sum + t.durationMinutes, 0);

    // Calculate how many study days this exam should use based on preferred daily study workload
    // e.g. 6 hours of study with 2h preferred daily workload -> 3 days!
    // e.g. 6 hours of study with 1h preferred daily workload -> 6 days!
    const idealDaysCount = Math.max(1, Math.min(validDatesForExam.length, Math.ceil(totalTopicMins / PREFERRED_MINUTES_PER_DAY)));
    // Focus study days towards the exam (the last `idealDaysCount` available dates before the exam)
    const activeDates = validDatesForExam.slice(-idealDaysCount);

    const targetDates: string[] = [];

    // Pass 1: Reserve 1 session for final review on day before exam if possible
    let unassignedTopics = [...topics];
    const dayBeforeExam = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
    
    if (unassignedTopics.length > 1 && validDatesForExam.includes(dayBeforeExam)) {
      const reviewTopic = unassignedTopics.pop()!;
      targetDates.push(dayBeforeExam);
      dailyLoadMinutes.set(dayBeforeExam, (dailyLoadMinutes.get(dayBeforeExam) || 0) + reviewTopic.durationMinutes);
    }

    // Pass 2: Workload-Aware Placement across active dates
    // Places each remaining topic onto the best available day matching user daily workload preferences
    for (let t = unassignedTopics.length - 1; t >= 0; t--) {
      const topic = unassignedTopics[t];
      const duration = topic.durationMinutes;

      let bestDay: string | null = null;

      // 1. Try to find day in activeDates where currentLoad + duration <= PREFERRED_MINUTES_PER_DAY
      // Iterate backwards so topics placed on the same load level fill days closest to exam
      let minLoadPref = Infinity;
      for (let i = activeDates.length - 1; i >= 0; i--) {
        const d = activeDates[i];
        const load = dailyLoadMinutes.get(d) || 0;
        if (load + duration <= PREFERRED_MINUTES_PER_DAY) {
          if (load < minLoadPref) {
            minLoadPref = load;
            bestDay = d;
          }
        }
      }

      // 2. If no day in activeDates fits under PREFERRED, try activeDates under MAX_MINUTES_PER_DAY
      if (!bestDay && !inputs.allowOverload) {
        let minLoadMax = Infinity;
        for (let i = activeDates.length - 1; i >= 0; i--) {
          const d = activeDates[i];
          const load = dailyLoadMinutes.get(d) || 0;
          if (load + duration <= MAX_MINUTES_PER_DAY) {
            if (load < minLoadMax) {
              minLoadMax = load;
              bestDay = d;
            }
          }
        }
      }

      // 3. If still no active date fits under MAX (active window full), expand to ANY earlier valid date for this exam!
      if (!bestDay && !inputs.allowOverload && validDatesForExam.length > activeDates.length) {
        let minLoadExpanded = Infinity;
        for (let i = validDatesForExam.length - 1; i >= 0; i--) {
          const d = validDatesForExam[i];
          const load = dailyLoadMinutes.get(d) || 0;
          if (load + duration <= MAX_MINUTES_PER_DAY) {
            if (load < minLoadExpanded) {
              minLoadExpanded = load;
              bestDay = d;
            }
          }
        }
      }

      // 4. If all valid dates are at or exceeding MAX_MINUTES_PER_DAY, pick the day with the lowest load overall
      if (!bestDay) {
        wasOverloadedGlobally = true;
        let minLoadOverall = Infinity;
        for (let i = validDatesForExam.length - 1; i >= 0; i--) {
          const d = validDatesForExam[i];
          const load = dailyLoadMinutes.get(d) || 0;
          if (load < minLoadOverall) {
            minLoadOverall = load;
            bestDay = d;
          }
        }
      }

      targetDates.push(bestDay!);
      dailyLoadMinutes.set(bestDay!, (dailyLoadMinutes.get(bestDay!) || 0) + duration);
    }

    // Sort target dates chronologically
    targetDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Place topics onto final Schedule Map chronologically
    for (let i = 0; i < topics.length; i++) {
      const dateStr = targetDates[i];
      if (!finalSchedule.has(dateStr)) finalSchedule.set(dateStr, new Map());
      
      const dayMap = finalSchedule.get(dateStr)!;
      if (!dayMap.has(exam.id)) dayMap.set(exam.id, []);
      
      dayMap.get(exam.id)!.push(topics[i]);
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

  require("fs").writeFileSync("/tmp/aiScheduler.log", "Final Schedule:\n" + Array.from(finalSchedule.entries()).map(([k,v]) => k + ": " + Array.from(v.entries()).map(([ek, ev]) => ek + " (" + ev.length + ")").join(", ")).join("\n") + "\nAvailable Dates: " + availableDates.join(",") + "\n");
  return { schedule: finalSchedule, wasOverloaded: wasOverloadedGlobally };
}

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
        const targetSessionMins = Math.min(90, Math.max(30, inputs.session_duration || 45)); // e.g. 45 or 60 min (around 1h, max 1.5h)

        for (const c of exam.studyMaterials) {
          const totalChapterMins = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60 * remainingRatio));
          
          if (totalChapterMins <= 90) {
            // Fits in 1 single session of 30-90 mins
            blocks.push({
              content: c.chapter,
              durationMinutes: totalChapterMins
            });
          } else {
            // Chapter is large (> 1.5h, e.g. 2h, 3h, 5.5h) -> split into digestible 45-60m chunks (max 90m per session)
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
      if (exam.studyMaterials && exam.studyMaterials.length > 0) {
        for (const c of exam.studyMaterials) {
          blocks.push({
            content: `Review: ${c.chapter}`,
            durationMinutes: 60
          });
        }
      } else {
        const neededHours = Math.max(1, exam.totalHours || 2);
        for (let i = 0; i < neededHours; i++) {
          blocks.push({
            content: `Review: ${exam.subject} Part ${i + 1}`,
            durationMinutes: 60
          });
        }
      }
    }

    examTopics.set(exam.id, blocks);
  }

  const MAX_MINUTES_PER_DAY = inputs.allowOverload ? 24 * 60 : inputs.daily_max_hours * 60;
  const PREFERRED_MINUTES_PER_DAY = inputs.allowOverload ? 24 * 60 : inputs.soft_daily_limit * 60;

  const finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
  const dailyCounts = new Map<string, number>();
  const dailyLoadMinutes = new Map<string, number>();
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

    const targetDates: string[] = [];
    let unassignedCount = topics.length;

    // Pass 1: Reserve 1 session for final review on day before exam
    const dayBeforeExam = new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
    if (unassignedCount > 1 && validDatesForExam.includes(dayBeforeExam)) {
      targetDates.push(dayBeforeExam);
      dailyCounts.set(dayBeforeExam, (dailyCounts.get(dayBeforeExam) || 0) + 1);
      dailyLoadMinutes.set(dayBeforeExam, (dailyLoadMinutes.get(dayBeforeExam) || 0) + (topics[topics.length - 1]?.durationMinutes || 60));
      unassignedCount--;
    }

    // Pass 2: Strict Global Water-Filling across all valid days
    // This perfectly flatlines the schedule across days so <= 1 session difference globally
    while (unassignedCount > 0) {
      let minLoad = Infinity;
      let minDay = validDatesForExam[validDatesForExam.length - 1]; // Default to latest

      // Iterate backwards so the FIRST day we find with the strict minimum load is the LATEST possible day
      for (let i = validDatesForExam.length - 1; i >= 0; i--) {
        const d = validDatesForExam[i];
        const load = dailyCounts.get(d) || 0;
        if (load < minLoad) {
          minLoad = load;
          minDay = d;
        }
      }

      targetDates.push(minDay);
      dailyCounts.set(minDay, minLoad + 1);
      const topicToPlace = topics[topics.length - 1 - unassignedCount];
      dailyLoadMinutes.set(minDay, (dailyLoadMinutes.get(minDay) || 0) + (topicToPlace?.durationMinutes || 60));
      unassignedCount--;
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

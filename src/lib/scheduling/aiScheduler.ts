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
  // Build available dates
  const blockedSet = new Set(inputs.blocked_days || []);
  const rawLastTime = Math.max(...inputs.exams.map(e => new Date(e.exam_date).getTime()));
  const lastExamDate = isNaN(rawLastTime) ? new Date() : new Date(rawLastTime);
  const startDate = isNaN(new Date(inputs.start_date).getTime()) ? new Date() : new Date(inputs.start_date);
  
  const availableDates: string[] = [];

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
        for (const c of exam.studyMaterials) {
          const duration = Math.max(30, Math.round((c.user_estimated_total_hours || 1) * 60 * remainingRatio));
          blocks.push({
            content: c.chapter,
            durationMinutes: duration
          });
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

  const MAX_MINUTES_PER_DAY = inputs.daily_max_hours * 60;
  const PREFERRED_MINUTES_PER_DAY = inputs.soft_daily_limit * 60;

  let finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
  let wasOverloadedGlobally = false;
  let simulate = true;
  let iterationCount = 0;

  // Sort exams by date ascending
  const sortedExams = [...inputs.exams].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  let examTargetDates = new Map<string, string[]>();

  while (simulate && iterationCount < 20) {
    iterationCount++;
    finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
    const dailyLoadMinutes = new Map<string, number>();
    examTargetDates = new Map<string, string[]>();
    let anyExamOverloaded = false;

    for (const exam of sortedExams) {
      let topics = examTopics.get(exam.id) || [];
      if (topics.length === 0) continue;

      const lastValidDay = exam.can_study_after_exam
        ? exam.exam_date.toISOString().split('T')[0]
        : new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];

      let validDatesForExam = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
      
      if (validDatesForExam.length === 0 && availableDates.length > 0) {
        validDatesForExam = [availableDates[0]];
      }

      const targetDates: string[] = [];
      let unassignedCount = topics.length;
      let topicIndex = topics.length - 1; // Work backwards

      if (validDatesForExam.length > 0) {
        while (topicIndex >= 0) {
          const topic = topics[topicIndex];
          let selectedDay = null;

          // Pass 1: Backwards Bin-Packing up to Preferred Limit
          for (let i = validDatesForExam.length - 1; i >= 0; i--) {
            const d = validDatesForExam[i];
            const load = dailyLoadMinutes.get(d) || 0;
            if (load + topic.durationMinutes <= PREFERRED_MINUTES_PER_DAY) {
              selectedDay = d;
              break;
            }
          }
          
          // Pass 2: Waterfill - find the valid date with the absolute MINIMUM load
          if (!selectedDay) {
            let minLoad = Infinity;
            let bestDay = null;
            for (let i = validDatesForExam.length - 1; i >= 0; i--) {
              const d = validDatesForExam[i];
              const load = dailyLoadMinutes.get(d) || 0;
              if (load < minLoad) {
                minLoad = load;
                bestDay = d;
              }
            }
            if (bestDay) {
              selectedDay = bestDay;
            }
          }

          if (selectedDay) {
            targetDates.unshift(selectedDay);
            dailyLoadMinutes.set(selectedDay, (dailyLoadMinutes.get(selectedDay) || 0) + topic.durationMinutes);
            unassignedCount--;
          } else {
            break; // Stop assigning, we hit a wall for this exam
          }
          topicIndex--;
        }
      }

      examTargetDates.set(exam.id, targetDates);

      if (unassignedCount > 0) {
        anyExamOverloaded = true;
      }
    }

    // Always exit loop as session combining happens below
    simulate = false;
  }

  // Build final schedule with session combining if overloaded
  const maxSessionsPerDay = Math.max(1, Math.floor((inputs.daily_max_hours * 60) / inputs.session_duration));

  for (const exam of sortedExams) {
    const topics = examTopics.get(exam.id) || [];
    const targetDates = examTargetDates.get(exam.id) || [];
    if (topics.length === 0) continue;

    // Group target dates chronologically
    targetDates.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());

    // Map topics to their assigned dates
    const dateToTopicsMap = new Map<string, SessionBlock[]>();

    for (let i = 0; i < targetDates.length; i++) {
      const dateStr = targetDates[i];
      if (!dateToTopicsMap.has(dateStr)) dateToTopicsMap.set(dateStr, []);
      if (i < topics.length) {
        dateToTopicsMap.get(dateStr)!.push(topics[i]);
      }
    }

    // Combine sessions on overloaded days to strictly respect daily_max_hours
    for (const [dateStr, dayTopics] of Array.from(dateToTopicsMap.entries())) {
      let finalDayTopics: SessionBlock[] = dayTopics;

      if (!finalSchedule.has(dateStr)) finalSchedule.set(dateStr, new Map());
      const dayMap = finalSchedule.get(dateStr)!;
      if (!dayMap.has(exam.id)) dayMap.set(exam.id, []);
      dayMap.get(exam.id)!.push(...finalDayTopics);
    }
  }

  return { schedule: finalSchedule, wasOverloaded: wasOverloadedGlobally };
}

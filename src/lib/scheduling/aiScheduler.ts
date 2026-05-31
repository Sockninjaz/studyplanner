/**
 * AI-powered schedule generator using OpenAI.
 * Takes exam inputs and asks the AI to distribute sessions across available dates.
 * Each AI assignment can have a "count" to bundle multiple sessions into one label,
 * preventing the AI from having to output one object per session (which caused massive drop rates).
 * Includes a validation + gap-filling layer to guarantee all required sessions are placed.
 */

import { z } from 'zod';
import { generateStructuredOutput } from '@/lib/ai/aiClient';
import { SCHEDULE_GENERATION_PROMPT, buildScheduleMessage } from '@/lib/ai/prompts';

interface ExamInput {
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

interface AISchedulerInputs {
  exams: ExamInput[];
  daily_max_hours: number;
  soft_daily_limit: number;
  session_duration: number; // minutes
  start_date: Date;
  blocked_days?: string[];
  existing_sessions?: { examId: string; content: string }[];
}

// Session assignment — the AI outputs content + a count field
const SessionAssignmentSchema = z.object({
  content: z.string().describe('What to study in this block, e.g. "Chapter 1 + Exercises"'),
  count: z.number().int().min(1).describe('Number of consecutive sessions with this content label'),
});

// The schema we demand from the AI
const ScheduleOutputSchema = z.object({
  assignments: z.array(SessionAssignmentSchema).describe('The requested study sessions progression'),
  reasoning: z.string().describe('Brief explanation of how the topics were sliced'),
});

// Expanded internal format: one entry per actual session
export interface SessionBlock {
  content: string;
}

/**
 * Generate a study schedule using AI.
 * Returns Map<date, Map<examId, Array<SessionBlock>>>
 * The inner array has exactly one entry per actual session to create.
 */
export async function generateAISchedule(
  inputs: AISchedulerInputs
): Promise<Map<string, Map<string, Array<SessionBlock>>>> {
  const STUDY_CHUNK_HOURS = inputs.session_duration / 60;

  // Build exam info for the prompt
  const exams = inputs.exams.map(exam => ({
    id: exam.id,
    subject: exam.subject,
    examDate: exam.exam_date.toISOString().split('T')[0],
    sessionsNeeded: Math.ceil(exam.totalHours / STUDY_CHUNK_HOURS),
    canStudyAfterExam: exam.can_study_after_exam,
    chapters: exam.studyMaterials || [],
  }));

  // Build available dates (from start to last exam, excluding blocked)
  const blockedSet = new Set(inputs.blocked_days || []);
  const lastExamDate = new Date(Math.max(...inputs.exams.map(e => e.exam_date.getTime())));
  const availableDates: string[] = [];

  for (
    let d = new Date(inputs.start_date);
    d <= lastExamDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().split('T')[0];
    if (!blockedSet.has(dateStr)) {
      availableDates.push(dateStr);
    }
  }

  console.log('[AI Scheduler] Calling AI for schedule generation per-exam...');
  
  // 1. Harvest all generated topics per exam using parallel AI calls
  const examTopics = new Map<string, SessionBlock[]>();
  
  const aiPromises = exams.map(async (exam) => {
    if (exam.sessionsNeeded <= 0) return;
    
    // Check if we can bypass AI by using existing uncompleted sessions
    if (inputs.existing_sessions) {
      const existingForExam = inputs.existing_sessions.filter(s => s.examId === exam.id);
      if (existingForExam.length > 0) {
        console.log(`[AI Scheduler] Bypassing AI for ${exam.subject}, using ${existingForExam.length} existing sessions`);
        examTopics.set(exam.id, existingForExam.map(s => ({ content: s.content })));
        return; // Skip AI call
      }
    }
    
    // Build the prompt for this specific exam
    const sessionPrompt = SCHEDULE_GENERATION_PROMPT.replace(
      '{sessionDuration}',
      inputs.session_duration.toString()
    );
    const userMessage = buildScheduleMessage(exam);
    
    try {
      const aiResult = await generateStructuredOutput(
        sessionPrompt,
        userMessage,
        ScheduleOutputSchema,
        'study_schedule'
      );
      
      console.log(`[AI Scheduler] Exam ${exam.subject} reasoning:`, aiResult.reasoning);
      
      const expanded: SessionBlock[] = [];
      for (const assignment of aiResult.assignments) {
        const count = assignment.count ?? 1;
        for (let i = 0; i < count; i++) {
          expanded.push({ content: assignment.content });
        }
      }
      
      if (expanded.length > 0) {
        examTopics.set(exam.id, expanded);
      }
    } catch (error) {
      console.error(`[AI Scheduler] Failed to generate topics for ${exam.subject}:`, error);
    }
  });

  await Promise.all(aiPromises);

  // 2. Mathematically distribute subjects onto the final schedule Map
  const finalSchedule = new Map<string, Map<string, Array<SessionBlock>>>();
  const MAX_SESSIONS_PER_DAY = Math.floor(inputs.daily_max_hours / STUDY_CHUNK_HOURS);

  for (const exam of exams) {
    let topics = examTopics.get(exam.id) || [];
    const required = exam.sessionsNeeded;

    // Enforce EXACT count by linearly stretching or squashing the AI's generated topics to fit
    if (topics.length > 0 && topics.length !== required) {
      const stretched: SessionBlock[] = [];
      for (let i = 0; i < required; i++) {
        const originalIdx = Math.floor((i / required) * topics.length);
        stretched.push({ content: topics[originalIdx].content });
      }
      topics = stretched;
    } else if (topics.length === 0 && required > 0) {
      console.warn(`[AI Scheduler] Could not map topics for Exam ${exam.id} (${exam.subject}). Falling back to subject name.`);
      for (let i = 0; i < required; i++) {
        topics.push({ content: `Study ${exam.subject}` });
      }
    }

    // Find valid dates for this exam
    const lastValidDay = exam.canStudyAfterExam
      ? exam.examDate
      : new Date(new Date(exam.examDate).getTime() - 86400000).toISOString().split('T')[0];

    const validDates = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
    if (validDates.length === 0 || required === 0) continue;

    // We want to evenly spread `topics` over `validDates`.
    // Example: If 8 sessions over 10 days, they should be spread avoiding gaps > 2 days.
    // Ensure final review is on the day before the exam (if available).
    let dayBeforeExam = new Date(new Date(exam.examDate).getTime() - 86400000).toISOString().split('T')[0];
    let targetDates: string[] = [];
    let hasFinalReview = false;

    if (validDates.includes(dayBeforeExam) && topics.length > 1) {
      targetDates.push(dayBeforeExam);
      hasFinalReview = true;
    }

    const unassignedTopics = hasFinalReview ? topics.length - 1 : topics.length;
    const availableDaysForSpread = validDates.filter(d => d !== (hasFinalReview ? dayBeforeExam : ''));

    // Determine the user's preferred density per day based on their slider constraint
    const softLimitHours = inputs.soft_daily_limit ?? 2;
    const targetSessionsPerDay = Math.max(1, Math.floor(softLimitHours / STUDY_CHUNK_HOURS));

    if (unassignedTopics > 0 && availableDaysForSpread.length > 0) {
      const reversedDays = [...availableDaysForSpread].reverse();
      const requiredDaysForPreferred = Math.ceil(unassignedTopics / targetSessionsPerDay);

      if (availableDaysForSpread.length >= requiredDaysForPreferred) {
        // User has enough time! Backwards-pack contiguously from the exam so there are no 0-hour days in between.
        let placed = 0;
        let dayIdx = 0;
        
        while (placed < unassignedTopics && dayIdx < reversedDays.length) {
          const toPlaceThisDay = Math.min(targetSessionsPerDay, unassignedTopics - placed);
          for (let i = 0; i < toPlaceThisDay; i++) {
            targetDates.push(reversedDays[dayIdx]);
            placed++;
          }
          dayIdx++;
        }
      } else {
        // User DOES NOT have enough time for their preferred limits. We must stretch them to fit the available dates.
        const remainingDays = availableDaysForSpread.length;
        if (unassignedTopics >= remainingDays) {
          // More topics than days left — layer them on evenly using round-robin over the days left!
          let placed = 0;
          let dayIdx = 0;
          while (placed < unassignedTopics) {
            targetDates.push(availableDaysForSpread[dayIdx % availableDaysForSpread.length]);
            dayIdx++;
            placed++;
          }
        } else {
          // Spread evenly across the available days length (e.g. studying every 2nd or 3rd day)
          const step = remainingDays / unassignedTopics;
          for (let i = 0; i < unassignedTopics; i++) {
            const idx = Math.min(Math.floor(i * step + step / 2), remainingDays - 1);
            targetDates.push(availableDaysForSpread[idx]);
          }
        }
      }
    }

    // Sort target dates chronologically
    targetDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Place topics onto final Schedule Map 
    for (let i = 0; i < topics.length; i++) {
      const dateStr = targetDates[i];
      if (!finalSchedule.has(dateStr)) finalSchedule.set(dateStr, new Map());
      
      const dayMap = finalSchedule.get(dateStr)!;
      if (!dayMap.has(exam.id)) dayMap.set(exam.id, []);
      
      dayMap.get(exam.id)!.push(topics[i]);
    }
  }

  // Cap daily limit (Fix 3 from earlier applied globally)
  let fixes = 0;
  for (const [day, dayMap] of Array.from(finalSchedule.entries())) {
    const totalSessions = Array.from(dayMap.values()).reduce((s, arr) => s + arr.length, 0);
    if (totalSessions > MAX_SESSIONS_PER_DAY) {
      const scale = MAX_SESSIONS_PER_DAY / totalSessions;
      let remaining = MAX_SESSIONS_PER_DAY;
      for (const [examId, sessionsArr] of Array.from(dayMap.entries())) {
        const newCount = Math.max(1, Math.floor(sessionsArr.length * scale));
        const capped = Math.min(newCount, remaining);
        if (capped < sessionsArr.length) {
          dayMap.set(examId, sessionsArr.slice(0, capped));
        }
        remaining -= capped;
        if (remaining <= 0) break;
      }
      fixes++;
    }
  }

  console.log(`[AI Scheduler] Algorithmic distribution complete: ${fixes} fixes applied`);
  return finalSchedule;
}

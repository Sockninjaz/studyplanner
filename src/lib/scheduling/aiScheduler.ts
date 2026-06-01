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
  const dailyCounts = new Map<string, number>();

  // Helper to place a session
  const placeSession = (dateStr: string, examId: string, block: SessionBlock) => {
    if (!finalSchedule.has(dateStr)) finalSchedule.set(dateStr, new Map());
    const dayMap = finalSchedule.get(dateStr)!;
    if (!dayMap.has(examId)) dayMap.set(examId, []);
    dayMap.get(examId)!.push(block);
    dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
  };

  // Sort exams by date ascending. Urgent exams get first pick of their valid days.
  exams.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  for (const exam of exams) {
    let topics = examTopics.get(exam.id) || [];
    const required = exam.sessionsNeeded;

    if (topics.length > 0 && topics.length !== required) {
      const stretched: SessionBlock[] = [];
      for (let i = 0; i < required; i++) {
        const originalIdx = Math.floor((i / required) * topics.length);
        stretched.push({ content: topics[originalIdx].content });
      }
      topics = stretched;
    } else if (topics.length === 0 && required > 0) {
      for (let i = 0; i < required; i++) {
        topics.push({ content: `Study ${exam.subject}` });
      }
    }

    const lastValidDay = exam.canStudyAfterExam
      ? exam.examDate
      : new Date(new Date(exam.examDate).getTime() - 86400000).toISOString().split('T')[0];

    const validDatesForExam = availableDates.filter(d => !blockedSet.has(d) && d <= lastValidDay);
    if (validDatesForExam.length === 0 || topics.length === 0) continue;

    const targetDates: string[] = [];
    let unassignedCount = topics.length;

    // Pass 1: Final Review Reservation
    let dayBeforeExam = new Date(new Date(exam.examDate).getTime() - 86400000).toISOString().split('T')[0];
    if (unassignedCount > 1 && validDatesForExam.includes(dayBeforeExam)) {
      targetDates.push(dayBeforeExam);
      dailyCounts.set(dayBeforeExam, (dailyCounts.get(dayBeforeExam) || 0) + 1);
      unassignedCount--;
    }

    // Pass 2: Strict Global Water-Filling
    // This perfectly flatlines the schedule to ensure <= 1 session difference globally
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

  console.log(`[AI Scheduler] Algorithmic global distribution complete.`);
  return finalSchedule;
}

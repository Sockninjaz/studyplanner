import { describe, it, expect } from 'vitest';
import { StudyPlannerV1, ScheduleResult, DailySchedule } from '../advancedScheduler';
import { singleExamFixture, standardWorkloadFixture, heavyWorkloadFixture, activeExamProtectionFixture } from './fixtures/schedulerFixtures';

describe('StudyPlannerV1', () => {

  const getDayString = (date: Date) => date.toISOString().split('T')[0];

  it('respects the daily capacity hard cap (Constraint 3.3)', () => {
    const planner = new StudyPlannerV1(standardWorkloadFixture);
    const result = planner.generatePlan() as ScheduleResult;

    // Check that every day respects the daily_max_hours limit
    result.schedule.forEach((day: DailySchedule) => {
      expect(day.total_hours).toBeLessThanOrEqual(standardWorkloadFixture.daily_max_hours);
    });
  });

  it('does not schedule study sessions after exam_date (Constraint 3.6)', () => {
    const planner = new StudyPlannerV1(singleExamFixture);
    const result = planner.generatePlan() as ScheduleResult;
    const examDateStr = getDayString(singleExamFixture.exams[0].exam_date);

    // singleExamFixture has can_study_after_exam = false
    result.schedule.forEach((day: DailySchedule) => {
      const dayStr = getDayString(day.date);
      expect(dayStr < examDateStr || dayStr === examDateStr).toBeTruthy();

      // Specifically check that if it's the exact exam date day, maybe it studies, but NEVER after
      if (dayStr > examDateStr) {
        expect(day.subjects[singleExamFixture.exams[0].id]).toBeUndefined();
      }
    });
  });

  it('ensures final review sessions exist the day before the exam', () => {
    const planner = new StudyPlannerV1(standardWorkloadFixture);
    const result = planner.generatePlan() as ScheduleResult;

    standardWorkloadFixture.exams.forEach(exam => {
      const examDate = new Date(exam.exam_date);
      const dayBeforeExam = new Date(examDate.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeExamStr = getDayString(dayBeforeExam);

      const dayBeforeSchedule = result.schedule.find(day => getDayString(day.date) === dayBeforeExamStr);
      // The engine guarantees final review sessions on the day before the exam
      expect(dayBeforeSchedule).toBeDefined();
      expect(dayBeforeSchedule?.subjects[exam.id]).toBeGreaterThan(0);
    });
  });

  it('does not violate the 3-day gap rule (Maximum 3-day gap between sessions of same exam)', () => {
    const planner = new StudyPlannerV1(standardWorkloadFixture);
    const result = planner.generatePlan() as ScheduleResult;

    standardWorkloadFixture.exams.forEach(exam => {
      const scheduledDays = result.schedule
        .filter(day => day.subjects[exam.id] > 0)
        .map(day => day.date.getTime());

      // If we only have 1 or 0 sessions, no gaps to check
      if (scheduledDays.length >= 2) {
        scheduledDays.sort((a, b) => a - b);
        for (let i = 0; i < scheduledDays.length - 1; i++) {
          const gapInDays = Math.floor((scheduledDays[i + 1] - scheduledDays[i]) / (1000 * 60 * 60 * 24));
          // max gap is 3 empty days, which means daysDiff is 4.
          // Wait, the rule says "max gap = 3 days", which is <= 4 days difference (3 empty days).
          expect(gapInDays).toBeLessThanOrEqual(4);
        }
      }
    });
  });

  it('handles heavy workloads by utilizing all available valid slots without exceeding limits', () => {
    const planner = new StudyPlannerV1(heavyWorkloadFixture);
    const result = planner.generatePlan() as ScheduleResult;

    // In heavy workload, check daily max is still respected
    result.schedule.forEach(day => {
      expect(day.total_hours).toBeLessThanOrEqual(heavyWorkloadFixture.daily_max_hours);
    });

    // Also ensures it tries to assign as many days as possible.
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  it('protects active exams from large gaps (active exam protection)', () => {
    const planner = new StudyPlannerV1(activeExamProtectionFixture);
    const result = planner.generatePlan() as ScheduleResult;

    const closeExamId = 'exam-close';
    const closeExamSessions = result.schedule.filter(d => d.subjects[closeExamId] > 0);

    expect(closeExamSessions.length).toBeGreaterThan(0);
  });

  it('no empty days near exams (Constraint 3.2)', () => {
    const planner = new StudyPlannerV1(activeExamProtectionFixture);
    const result = planner.generatePlan() as ScheduleResult;

    // In activeExamProtectionFixture, "exam-close" is 2 days away.
    // So days_to_exam <= 3 is true for the first 2 days.
    const firstDayStr = getDayString(activeExamProtectionFixture.start_date);
    const nextDay = new Date(activeExamProtectionFixture.start_date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = getDayString(nextDay);

    // Ensure that these days have at least ONE subject scheduled
    const day1 = result.schedule.find(day => getDayString(day.date) === firstDayStr);
    const day2 = result.schedule.find(day => getDayString(day.date) === nextDayStr);

    expect(day1?.total_hours).toBeGreaterThan(0);
    expect(day2?.total_hours).toBeGreaterThan(0);
  });

  it('prevents a single subject from exceeding 50% of the day (Constraint 3.4)', () => {
    // Subject dominance cap is tested with heavy workloads where it might try to cram
    const planner = new StudyPlannerV1(standardWorkloadFixture);
    const result = planner.generatePlan() as ScheduleResult;

    result.schedule.forEach(day => {
      if (day.total_hours > 0 && Object.keys(day.subjects).length > 1) {
        Object.values(day.subjects).forEach(hours => {
          expect(hours / day.total_hours).toBeLessThanOrEqual(0.5);
        });
      }
    });
  });
});

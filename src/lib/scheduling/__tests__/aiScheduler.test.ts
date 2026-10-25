import { describe, it, expect } from 'vitest';
import { generateAISchedule, AISchedulerInputs } from '../aiScheduler';

describe('aiScheduler - Exam Isolation and Workload Leveling', () => {
  it('isolates the final exam to the window after earlier exams when capacity fits', async () => {
    // Math on Nov 10, German on Nov 12. German needs 3 sessions (total 180 min).
    // Capacity of Nov 10 (afternoon) and Nov 11 (full day) is 3-4 sessions.
    // German must NOT be scheduled on Nov 6, 7, 8, or 9!
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'math',
          subject: 'Wiskunde',
          exam_date: new Date('2026-11-10T09:00:00.000Z'),
          totalHours: 6,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'H1 Algebra', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'H2 Meetkunde', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'H3 Functies', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'H4 Kansrekening', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'H5 Differentiëren', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'german',
          subject: 'Duits',
          exam_date: new Date('2026-11-12T09:00:00.000Z'),
          totalHours: 3,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Grammatik & Woorden', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Leseverstehen', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-11-06T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    // Collect all dates where German (duits) is scheduled
    const germanDates: string[] = [];
    for (const [dateStr, dayMap] of schedule.entries()) {
      if (dayMap.has('german') && dayMap.get('german')!.length > 0) {
        germanDates.push(dateStr);
      }
    }

    // German must only be scheduled on or after Math exam date (2026-11-10), not on Nov 6, 7, 8, or 9
    expect(germanDates.length).toBeGreaterThan(0);
    germanDates.forEach(d => {
      expect(d >= '2026-11-10').toBe(true);
    });

    // Nov 11 (the day before German exam) must have sessions for German
    const nov11Sessions = schedule.get('2026-11-11')?.get('german');
    expect(nov11Sessions).toBeDefined();
    expect(nov11Sessions!.length).toBeGreaterThanOrEqual(1);
  });

  it('levels daily workload and eliminates 3-hour crunch days when lighter days exist', async () => {
    // 8 topics across 5 available days: average should be ~1-2 sessions per day.
    // No day should have 3 sessions if lighter days (<= 1 session) are available.
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'physics',
          subject: 'Natuurkunde',
          exam_date: new Date('2026-11-10T09:00:00.000Z'),
          totalHours: 8,
          can_study_after_exam: false,
          studyMaterials: [
            { chapter: 'Krachten', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Elektriciteit', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Golven', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Optica', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Energie', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Atoomfysica', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-11-05T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    // Check session count and duration per day
    const dailyCounts: number[] = [];
    const dailyDurations: number[] = [];

    for (const [dateStr, dayMap] of schedule.entries()) {
      let totalMins = 0;
      let count = 0;
      for (const [, sessions] of dayMap.entries()) {
        count += sessions.length;
        totalMins += sessions.reduce((s, b) => s + b.durationMinutes, 0);
      }
      if (count > 0) {
        dailyCounts.push(count);
        dailyDurations.push(totalMins);
      }
    }

    expect(dailyCounts.length).toBeGreaterThan(0);
    // Every active day should be smooth (at most 2 sessions, total minutes <= 150m)
    const maxDailyCount = Math.max(...dailyCounts);
    const minDailyCount = Math.min(...dailyCounts);
    expect(maxDailyCount).toBeLessThanOrEqual(2);
    // The disparity between min and max count should be at most 1 (±1 rule)
    expect(maxDailyCount - minDailyCount).toBeLessThanOrEqual(1);
    // No day should reach 3 hours (180 min)
    dailyDurations.forEach(mins => {
      expect(mins).toBeLessThan(180);
    });
  });

  it('protects the exclusive pre-exam day (day before exam) from unrelated exams', async () => {
    // Chemistry exam on Nov 7, History exam on Nov 14.
    // Nov 6 (day before Chemistry) must NOT be filled with History sessions.
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'chemistry',
          subject: 'Scheikunde',
          exam_date: new Date('2026-11-07T09:00:00.000Z'),
          totalHours: 3,
          can_study_after_exam: false,
          studyMaterials: [
            { chapter: 'Zouten', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Koolstofchemie', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'history',
          subject: 'Geschiedenis',
          exam_date: new Date('2026-11-14T09:00:00.000Z'),
          totalHours: 4,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Tijdvak 5', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Tijdvak 6', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Tijdvak 7', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-11-01T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    // Nov 6 is the day before Chemistry. It should NOT contain History.
    const nov6History = schedule.get('2026-11-06')?.get('history');
    expect(nov6History === undefined || nov6History.length === 0).toBe(true);

    // Nov 6 MUST contain Chemistry review
    const nov6Chem = schedule.get('2026-11-06')?.get('chemistry');
    expect(nov6Chem).toBeDefined();
    expect(nov6Chem!.length).toBeGreaterThanOrEqual(1);
  });

  it('matches the real user scenario: isolates German after Math, prevents Math 3-hour crunch, and levels daily load', async () => {
    // Exact user scenario from screenshot:
    // Wed Nov 4: Scheikunde
    // Thu Nov 5: Natuurkunde
    // Fri Nov 6: Nederlands
    // Tue Nov 10: Wiskunde
    // Thu Nov 12: Duits
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'scheikunde',
          subject: 'Scheikunde',
          exam_date: new Date('2026-11-04T09:00:00.000Z'),
          totalHours: 6,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Zouten & Zuren', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Koolstofchemie', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Reactiesnelheid', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'natuurkunde',
          subject: 'Natuurkunde',
          exam_date: new Date('2026-11-05T09:00:00.000Z'),
          totalHours: 6,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Krachten & Beweging', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Elektriciteit', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Golven & Trillingen', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'nederlands',
          subject: 'Nederlands',
          exam_date: new Date('2026-11-06T09:00:00.000Z'),
          totalHours: 4,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Tekstbegrip & Argumentatie', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Spelling & Formulering', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'wiskunde',
          subject: 'Wiskunde',
          exam_date: new Date('2026-11-10T09:00:00.000Z'),
          totalHours: 8,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Algebra & Vergelijkingen', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Meetkunde & Vectoren', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Goniometrie', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Functies & Grafieken', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Differentiëren & Integreren', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'duits',
          subject: 'Duits',
          exam_date: new Date('2026-11-12T09:00:00.000Z'),
          totalHours: 3,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Grammatik & Naamvallen', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Leseverstehen & Woorden', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-10-24T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    // 1. German must ONLY be scheduled on or after Math exam date (2026-11-10)
    const germanDates: string[] = [];
    for (const [dateStr, dayMap] of schedule.entries()) {
      if (dayMap.has('duits') && dayMap.get('duits')!.length > 0) {
        germanDates.push(dateStr);
      }
    }
    expect(germanDates.length).toBeGreaterThan(0);
    germanDates.forEach(d => {
      // Must not be scheduled on Nov 6, 7, 8, 9
      expect(d >= '2026-11-10').toBe(true);
    });

    // 2. Nov 11 (the day before German exam) must have substantial German study (>= 2 sessions / >= 120m)
    // instead of only 60m
    const nov11German = schedule.get('2026-11-11')?.get('duits');
    expect(nov11German).toBeDefined();
    expect(nov11German!.length).toBeGreaterThanOrEqual(2);

    // 3. Math must NOT have a 3-hour crunch day (180 min) on Nov 9
    const nov9Math = schedule.get('2026-11-09')?.get('wiskunde') || [];
    const nov9MathMins = nov9Math.reduce((sum, b) => sum + b.durationMinutes, 0);
    expect(nov9MathMins).toBeLessThan(180);

    // 4. No active day across the entire calendar exceeds 135 minutes or 2 sessions
    for (const [dateStr, dayMap] of schedule.entries()) {
      let totalMins = 0;
      let totalCount = 0;
      for (const [, sessions] of dayMap.entries()) {
        totalCount += sessions.length;
        totalMins += sessions.reduce((s, b) => s + b.durationMinutes, 0);
      }
      if (totalCount > 0) {
        expect(totalMins).toBeLessThanOrEqual(135);
        expect(totalCount).toBeLessThanOrEqual(2);
      }
    }
  });

  it('prevents 180-min days and isolates trailing exam even when it has 4+ sessions from larger materials', async () => {
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'scheikunde',
          subject: 'Scheikunde',
          exam_date: new Date('2026-11-04T09:00:00.000Z'),
          totalHours: 4.5,
          studyMaterials: [
            { chapter: 'Zuren & Basen', difficulty: 3, user_estimated_total_hours: 1.5 },
            { chapter: 'Redoxreacties', difficulty: 3, user_estimated_total_hours: 1.5 },
          ],
        },
        {
          id: 'wiskunde',
          subject: 'Wiskunde',
          exam_date: new Date('2026-11-10T09:00:00.000Z'),
          totalHours: 6,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'Algebra', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Meetkunde', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Goniometrie', difficulty: 3, user_estimated_total_hours: 1 },
            { chapter: 'Functies', difficulty: 3, user_estimated_total_hours: 1 },
          ],
        },
        {
          id: 'duits',
          subject: 'Duits',
          exam_date: new Date('2026-11-12T09:00:00.000Z'),
          totalHours: 4.5,
          can_study_after_exam: true,
          studyMaterials: [
            { chapter: 'H1: Literatuur en context. Duits', difficulty: 3, user_estimated_total_hours: 1.5 },
            { chapter: 'H2: Literaire tekstsoorten en begrippen. Duits', difficulty: 3, user_estimated_total_hours: 1.5 },
            { chapter: 'H3: Literatuurgeschiedenis en hoofdthema\'s. Duits', difficulty: 3, user_estimated_total_hours: 1.5 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-10-25T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    // 1. Total scheduled German study time must EXACTLY equal agreed 4.5 hours (270 minutes), NOT 5.5h
    let totalGermanMins = 0;
    let totalGermanSessions = 0;
    const germanDates: string[] = [];
    for (const [dateStr, dayMap] of schedule.entries()) {
      if (dayMap.has('duits')) {
        const sessions = dayMap.get('duits')!;
        totalGermanSessions += sessions.length;
        for (const s of sessions) {
          totalGermanMins += s.durationMinutes;
          germanDates.push(dateStr);
        }
      }
    }
    expect(totalGermanMins).toBe(270); // 4.5 hours * 60 = 270 min exactly
    expect(totalGermanSessions).toBe(6); // 6 sessions of 45 min each

    // 2. German must ONLY be scheduled on or after Math exam date (2026-11-10) — 0 on Nov 6, 7, 8, 9
    germanDates.forEach(d => {
      expect(d >= '2026-11-10').toBe(true);
    });

    // 3. Nov 11 must have at least 2 German sessions (substantial final prep)
    const nov11German = schedule.get('2026-11-11')?.get('duits');
    expect(nov11German).toBeDefined();
    expect(nov11German!.length).toBeGreaterThanOrEqual(2);

    // 4. No day in the entire schedule has >= 180 min (max 150m on pre-exam days, <= 135m on regular days)
    for (const [dateStr, dayMap] of schedule.entries()) {
      let dayMins = 0;
      for (const [, sessions] of dayMap.entries()) {
        for (const s of sessions) {
          expect(s.durationMinutes).toBeLessThanOrEqual(75);
          dayMins += s.durationMinutes;
        }
      }
      expect(dayMins).toBeLessThanOrEqual(150);
      if (dateStr !== '2026-11-11' && dateStr !== '2026-11-03') {
        expect(dayMins).toBeLessThanOrEqual(135);
      }
    }
  });

  it('guarantees exact study time preservation for exams with multi-hour chapters (Chemistry 8.5h)', async () => {
    const inputs: AISchedulerInputs = {
      exams: [
        {
          id: 'scheikunde',
          subject: 'Scheikunde',
          exam_date: new Date('2026-11-04T09:00:00.000Z'),
          totalHours: 8.5,
          studyMaterials: [
            { chapter: 'H12: Molecuulbouw. Chemie Overal', difficulty: 3, user_estimated_total_hours: 2 },
            { chapter: 'H13: Kunststoffen. Chemie Overal', difficulty: 3, user_estimated_total_hours: 2 },
            { chapter: 'H15: Biochemie. Chemie Overal', difficulty: 4, user_estimated_total_hours: 2 },
            { chapter: 'H16: Groene chemie. Chemie Overal', difficulty: 4, user_estimated_total_hours: 2.5 },
          ],
        },
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 60,
      start_date: new Date('2026-10-25T00:00:00.000Z'),
    };

    const { schedule } = await generateAISchedule(inputs);

    let totalChemMinutes = 0;
    let totalChemSessions = 0;
    for (const [, dayMap] of schedule.entries()) {
      if (dayMap.has('scheikunde')) {
        for (const s of dayMap.get('scheikunde')!) {
          totalChemMinutes += s.durationMinutes;
          totalChemSessions++;
          // Sessions should be standard clean lengths (50m or 60m), not mangled into 40m
          expect(s.durationMinutes).toBeGreaterThanOrEqual(50);
          expect(s.durationMinutes).toBeLessThanOrEqual(75);
        }
      }
    }

    // Must EXACTLY equal the 8.5 hours agreed in exam creation (510 minutes)
    expect(totalChemMinutes).toBe(510);
    expect(totalChemSessions).toBe(9); // 6 sessions of 60m + 3 sessions of 50m = 510m
  });
});

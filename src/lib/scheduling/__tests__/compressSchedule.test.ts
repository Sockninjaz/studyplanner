import { describe, it, expect } from 'vitest';
import { compressSessionsInMemory } from '../compressSchedule';

describe('compressSessionsInMemory', () => {
  it('Under Limit: Sessions unchanged when <= maxSessionsPerDay', () => {
    const sessions = [
      { startTime: new Date('2026-10-23T10:00:00Z'), endTime: new Date('2026-10-23T11:00:00Z'), title: 'Session 1' },
      { startTime: new Date('2026-10-23T12:00:00Z'), endTime: new Date('2026-10-23T13:00:00Z'), title: 'Session 2' },
    ];

    // maxSessionsPerDay = 3
    const result = compressSessionsInMemory(sessions, 3);

    expect(result.length).toBe(2);
    expect(result[0].title).toBe('Session 1');
    expect(result[1].title).toBe('Session 2');
  });

  it('Over Limit: Groups 6 sessions into exactly 3 chunks when max is 3', () => {
    const sessions = [
      { startTime: new Date('2026-10-23T08:00:00Z'), endTime: new Date('2026-10-23T09:00:00Z'), title: 'Session 1' },
      { startTime: new Date('2026-10-23T09:00:00Z'), endTime: new Date('2026-10-23T10:00:00Z'), title: 'Session 2' },
      { startTime: new Date('2026-10-23T10:00:00Z'), endTime: new Date('2026-10-23T11:00:00Z'), title: 'Session 3' },
      { startTime: new Date('2026-10-23T11:00:00Z'), endTime: new Date('2026-10-23T12:00:00Z'), title: 'Session 4' },
      { startTime: new Date('2026-10-23T12:00:00Z'), endTime: new Date('2026-10-23T13:00:00Z'), title: 'Session 5' },
      { startTime: new Date('2026-10-23T13:00:00Z'), endTime: new Date('2026-10-23T14:00:00Z'), title: 'Session 6' },
    ];

    const result = compressSessionsInMemory(sessions, 3);

    // Check it grouped into exactly 3 chunks
    expect(result.length).toBe(3);

    // Each grouped chunk should indicate it merged 2 sessions
    expect(result[0]._enrichMeta.numMerged).toBe(2);
    expect(result[1]._enrichMeta.numMerged).toBe(2);
    expect(result[2]._enrichMeta.numMerged).toBe(2);
  });

  it('Checklist Merging: Checklist items / chapters are preserved', () => {
    const sessions = [
      {
        startTime: new Date('2026-10-23T10:00:00Z'),
        endTime: new Date('2026-10-23T11:00:00Z'),
        title: 'Study: Algebra',
        _enrichMeta: { chapter: 'Algebra' }
      },
      {
        startTime: new Date('2026-10-23T11:00:00Z'),
        endTime: new Date('2026-10-23T12:00:00Z'),
        title: 'Study: Geometry',
        _enrichMeta: { chapter: 'Geometry' }
      },
    ];

    const result = compressSessionsInMemory(sessions, 1);

    expect(result.length).toBe(1);
    // Combined title should include both
    expect(result[0].shortTitle).toContain('Algebra');
    expect(result[0].shortTitle).toContain('Geometry');
    // Enriched meta should have the combined chapter
    expect(result[0]._enrichMeta.chapter).toBe('Algebra & Geometry');
  });

  it('Time Bounds: Start time matches first session, duration is bounded', () => {
    const sessions = [
      { startTime: new Date('2026-10-23T08:00:00Z'), endTime: new Date('2026-10-23T09:00:00Z'), title: 'Session 1' }, // 60 mins
      { startTime: new Date('2026-10-23T09:00:00Z'), endTime: new Date('2026-10-23T10:00:00Z'), title: 'Session 2' }, // 60 mins
    ];

    // If we merge these 2 into 1 session, start time is 08:00
    const result = compressSessionsInMemory(sessions, 1);
    expect(result.length).toBe(1);
    expect(result[0].startTime).toEqual(new Date('2026-10-23T08:00:00Z'));
    // The total duration was 120 mins, average is 60 mins. The merged session uses bounded averages
    // Our algorithm takes avgDuration (60mins) and bounds it. Check end time > start time
    expect(result[0].endTime.getTime()).toBeGreaterThan(result[0].startTime.getTime());
  });

  it('Edge Cases: Empty array, single session array, multiple days', () => {
    // Empty
    expect(compressSessionsInMemory([], 2).length).toBe(0);

    // Single session
    const single = [{ startTime: new Date('2026-10-23T10:00:00Z'), endTime: new Date('2026-10-23T11:00:00Z'), title: 'Session 1' }];
    expect(compressSessionsInMemory(single, 2).length).toBe(1);

    // Multiple days
    const multi = [
      { startTime: new Date('2026-10-23T10:00:00Z'), endTime: new Date('2026-10-23T11:00:00Z'), title: 'Day 1' },
      { startTime: new Date('2026-10-24T10:00:00Z'), endTime: new Date('2026-10-24T11:00:00Z'), title: 'Day 2' },
    ];
    const resultMulti = compressSessionsInMemory(multi, 1);
    expect(resultMulti.length).toBe(2);
    expect(resultMulti[0].startTime).toEqual(new Date('2026-10-23T10:00:00Z'));
    expect(resultMulti[1].startTime).toEqual(new Date('2026-10-24T10:00:00Z'));
  });
});

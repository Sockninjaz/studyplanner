/**
 * Test adding a middle exam to see how it breaks the preferred average
 */
import { StudyPlannerV1 } from './src/lib/scheduling/advancedScheduler';

const exam2 = { id: 'e2', subject: '2', exam_date: new Date('2026-03-03T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };
const exam1 = { id: 'e1', subject: '1', exam_date: new Date('2026-03-04T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };

// Adding a middle exam!
const math123 = { id: 'math123', subject: 'math123', exam_date: new Date('2026-03-08T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };

const exam2122 = { id: 'e2122', subject: '2122', exam_date: new Date('2026-03-11T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };
const math1 = { id: 'math1', subject: 'math', exam_date: new Date('2026-03-11T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };
const bio12 = { id: 'bio12', subject: 'bio12', exam_date: new Date('2026-03-12T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };
const math2 = { id: 'math2', subject: 'math2', exam_date: new Date('2026-03-12T01:00:00.000Z'), difficulty: 3, confidence: 3, user_estimated_total_hours: 5, can_study_after_exam: false };

const exams = [exam2, exam1, math123, exam2122, math1, bio12, math2];
const c: Record<string, number> = {};
for (const e of exams) c[e.id] = 0;

const inputs = {
    daily_max_hours: 4,
    soft_daily_limit: 3,   // Test with 3h preferred
    session_duration: 60,
    adjustment_percentage: 25,
    start_date: new Date('2026-02-24T00:00:00.000Z'),
    existing_sessions: [],
    completed_hours: c,
    exams,
    blocked_days: [] as string[],
};

const scheduler = new StudyPlannerV1(inputs);
const result = scheduler.generatePlan();

if ('error' in result) {
    console.log('Error:', result.error);
} else {
    const schedule = (result as any).schedule || result;
    console.log('\n=== SCHEDULE ===');
    let spikes = 0;
    let totalH = 0;
    let daysUsed = 0;
    for (const day of schedule) {
        if (day.total_hours === 0) continue;
        daysUsed++;
        totalH += day.total_hours;
        const subs = Object.entries(day.subjects).map(([id, h]) => `${exams.find(e => e.id === id)?.subject}:${h}h`).join(', ');
        const flag = day.total_hours > inputs.daily_max_hours ? ' 🚨 SPIKE!' : '';
        console.log(`${day.date.toISOString().split('T')[0]}: ${day.total_hours}h [${subs}]${flag}`);
        if (day.total_hours > inputs.daily_max_hours) spikes++;
    }
    console.log(`\nTotal: ${totalH}h over ${daysUsed} days = ${(totalH / daysUsed).toFixed(1)}h/day avg`);
    console.log(spikes === 0 ? '✅ NO SPIKES' : `❌ ${spikes} SPIKES`);
}

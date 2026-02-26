import { StudyPlannerV1 } from './src/lib/scheduling/advancedScheduler.js';

const planner = new StudyPlannerV1({
    start_date: new Date('2026-02-01T00:00:00.000Z'),
    session_duration: 60,
    daily_max_hours: 4,
    soft_daily_limit: 3,
    exams: [
        {
            id: "1",
            subject: "111111",
            exam_date: new Date('2026-03-12T00:00:00.000Z'),
            difficulty: 3,
            confidence: 3,
            user_estimated_total_hours: 10,
            can_study_after_exam: false,
        }
    ] as any,
    blocked_days: [],
    existing_sessions: []
} as any);

console.log("Generating plan...");
const result = planner.generatePlan();
console.log("Plan generated.");
const schedules = (result as any).schedule;
console.log("s13e2 sessions:");
schedules.forEach((day: any) => {
    if (day.subjects["s13e2"]) {
        console.log(day.date.toISOString().split('T')[0], day.subjects["s13e2"], "hours");
    }
});

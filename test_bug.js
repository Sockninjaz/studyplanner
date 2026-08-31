"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var advancedScheduler_1 = require("./src/lib/scheduling/advancedScheduler");
var now = new Date();
var examDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
var planner = new advancedScheduler_1.StudyPlannerV1({
    daily_max_hours: 4,
    adjustment_percentage: 0,
    session_duration: 60,
    start_date: now,
    soft_daily_limit: 1,
    enable_daily_limits: true,
    exams: [
        {
            id: 'exam1',
            subject: 'Math',
            exam_date: examDate,
            difficulty: 3,
            confidence: 3,
            user_estimated_total_hours: 8,
            can_study_after_exam: false
        }
    ]
});
var result = planner.generatePlan();
console.log(JSON.stringify(result, null, 2));

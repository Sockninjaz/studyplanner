import { StudyPlannerV1 } from './src/lib/scheduling/advancedScheduler';

const now = new Date();
const examDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

const planner = new StudyPlannerV1({
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

const result = planner.generatePlan();
console.log(JSON.stringify(result, null, 2));

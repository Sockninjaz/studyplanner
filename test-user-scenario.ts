import { StudyPlannerV1 } from './src/lib/scheduling/advancedScheduler';

const today = new Date();
today.setHours(0,0,0,0);
const exam14 = new Date(today); exam14.setDate(exam14.getDate() + 14);

function run(softLimit: number) {
  const inputs: any = {
    daily_max_hours: 12,
    soft_daily_limit: softLimit,
    session_duration: 60,
    start_date: today,
    existing_sessions: [],
    completed_hours: {},
    exams: [
      { id: '1', subject: 'A', exam_date: exam14, difficulty: 5, confidence: 5, user_estimated_total_hours: 5, can_study_after_exam: false },
      { id: '2', subject: 'B', exam_date: exam14, difficulty: 5, confidence: 5, user_estimated_total_hours: 5, can_study_after_exam: false },
      { id: '3', subject: 'C', exam_date: exam14, difficulty: 5, confidence: 5, user_estimated_total_hours: 5, can_study_after_exam: false },
      { id: '4', subject: 'D', exam_date: exam14, difficulty: 5, confidence: 5, user_estimated_total_hours: 5, can_study_after_exam: false },
    ]
  };
  const plan = new StudyPlannerV1(inputs).generatePlan() as any;
  const schedule = plan.schedule ?? plan;
  console.log(`\n=== soft_daily_limit=${softLimit} ===`);
  schedule.forEach((day: any) => {
    const total = Object.values(day.subjects as any).reduce((s: number, v: any) => s + v, 0);
    if (total > 0) console.log(`  ${day.date.toISOString().split('T')[0]}: ${total}h`);
  });
}

run(2);
run(3);

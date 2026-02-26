import { StudyPlannerV1 } from './src/lib/scheduling/advancedScheduler';

const now = new Date();
now.setHours(0, 0, 0, 0);
// 2 weeks away
const d1 = new Date(now); d1.setDate(d1.getDate() + 10);
const d2 = new Date(now); d2.setDate(d2.getDate() + 12);
const d3 = new Date(now); d3.setDate(d3.getDate() + 14);

function run(soft: number) {
  const inputs: any = {
    daily_max_hours: 5,
    soft_daily_limit: soft,
    session_duration: 60,
    existing_sessions: [],
    completed_hours: {},
    exams: [
      { id: '1', subject: 'Exam1', exam_date: d1, difficulty: 5, confidence: 5, user_estimated_total_hours: 10, can_study_after_exam: false },
      { id: '2', subject: 'Exam2', exam_date: d2, difficulty: 5, confidence: 5, user_estimated_total_hours: 10, can_study_after_exam: false },
      { id: '3', subject: 'Exam3', exam_date: d3, difficulty: 5, confidence: 5, user_estimated_total_hours: 10, can_study_after_exam: false },
    ]
  };
  console.log(`\n=== Soft limit: ${soft} ===`);
  const plan = new StudyPlannerV1(inputs).generatePlan() as any;
  (plan.schedule ?? plan).forEach((day: any) => {
    const total = Object.values(day.subjects as any).reduce((s: number, v: any) => s + v, 0);
    if (total > 0) console.log(`  ${day.date.toISOString().split('T')[0]}: ${total}h`);
  });
}
run(2);
run(3);

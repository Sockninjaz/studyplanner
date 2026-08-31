import { generateAISchedule } from './src/lib/scheduling/aiScheduler';
const inputs = {
  exams: [{
    id: "exam1",
    subject: "Math",
    exam_date: new Date(Date.now() + 86400000 * 5),
    totalHours: 5,
    can_study_after_exam: false,
    studyMaterials: []
  }],
  daily_max_hours: 4,
  soft_daily_limit: 2,
  session_duration: 30,
  start_date: new Date(),
  existing_sessions: [
    { examId: "exam1", content: "Session 1" },
    { examId: "exam1", content: "Session 2" }
  ],
  allowOverload: false
};
generateAISchedule(inputs as any).then(r => console.log(r)).catch(e => console.error(e));

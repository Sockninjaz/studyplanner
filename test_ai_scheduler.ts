import { generateAISchedule } from './src/lib/scheduling/aiScheduler';

async function runTest() {
  const now = new Date();
  const examDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const inputs = {
    daily_max_hours: 4,
    soft_daily_limit: 1,
    session_duration: 60,
    start_date: now,
    allowOverload: true,
    exams: [
      {
        id: 'exam1',
        subject: 'Math',
        exam_date: examDate,
        totalHours: 8,
        can_study_after_exam: false,
        studyMaterials: [
          { chapter: 'Chapter 1', difficulty: 3, user_estimated_total_hours: 8 }
        ]
      }
    ]
  };

  const result = await generateAISchedule(inputs);
  console.log("=== AI SCHEDULER RESULT ===");
  for (const [date, examMap] of result.schedule.entries()) {
    for (const [examId, sessions] of examMap.entries()) {
      console.log(`Day ${date}: ${sessions.length} sessions`);
    }
  }
}

runTest().catch(console.error);

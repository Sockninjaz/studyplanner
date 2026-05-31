import { generateAISchedule } from './src/lib/scheduling/aiScheduler';
import { z } from 'zod';

async function run() {
  const inputs: any = {
    daily_max_hours: 4,
    session_duration: 30, // 30 mins
    soft_daily_limit: 2,
    adjustment_percentage: 20,
    start_date: new Date(),
    exams: [
      {
        id: 'exam-natuurkunde',
        subject: 'Natuurkunde',
        exam_date: new Date(new Date().getTime() + 10 * 86400000), // 10 days from now
        totalHours: 2, // 4 sessions
        can_study_after_exam: false,
        studyMaterials: [
          { chapter: '11.1 Elektromagnetisch spectrum', user_estimated_total_hours: 1 },
          { chapter: '11.2 Wet van Wien', user_estimated_total_hours: 1 }
        ]
      },
      {
        id: 'exam-duits',
        subject: 'Duits Formele Brief',
        exam_date: new Date(new Date().getTime() + 5 * 86400000), // 5 days from now
        totalHours: 2, // 4 sessions
        can_study_after_exam: false,
        studyMaterials: [
          { chapter: 'Formal Letter/E-mail Writing Instructions', user_estimated_total_hours: 2 }
        ]
      }
    ],
    blocked_days: []
  };

  try {
    const finalSchedule = await generateAISchedule(inputs);
    for (const [date, dayMap] of Array.from(finalSchedule.entries())) {
      console.log(`\nDate: ${date}`);
      for (const [examId, sessions] of Array.from(dayMap.entries())) {
        console.log(`  Exam ${examId}: ${sessions.length} sessions`);
        console.log(sessions);
      }
    }
  } catch (error) {
    console.error("Simulation failed:", error);
  }
}

run();

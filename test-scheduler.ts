import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { generateAISchedule } from './src/lib/scheduling/aiScheduler';
import util from 'util';

async function test() {
  try {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    const inputs = {
      exams: [
        {
          id: 'exam1',
          subject: 'Math',
          exam_date: d,
          totalHours: 4,
          can_study_after_exam: false,
          studyMaterials: []
        }
      ],
      daily_max_hours: 4,
      soft_daily_limit: 2,
      session_duration: 30,
      start_date: new Date(),
      blocked_days: []
    };

    console.log("Calling generateAISchedule...");
    const res = await generateAISchedule(inputs);
    
    // Print deep inspect of the map
    console.log("Output schedule Map:");
    for (const [date, dayMap] of Array.from(res.entries())) {
      console.log("Date:", date);
      for (const [examId, sessions] of Array.from(dayMap.entries())) {
        console.log(`  Exam ${examId}: ${sessions.length} sessions `, sessions);
      }
    }
  } catch (e) {
    console.error("Caught error:", e);
  }
}

test();

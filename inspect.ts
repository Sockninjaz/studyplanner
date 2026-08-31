import mongoose from 'mongoose';
import Exam from './src/models/Exam';
import StudySession from './src/models/StudySession';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const exams = await Exam.find();
  console.log("Exams:");
  exams.forEach(e => console.log(e.subject, e.date));
  
  const sessions = await StudySession.find();
  console.log(`Sessions total: ${sessions.length}`);
  let activeSessions = 0;
  sessions.forEach(s => {
    if(!s.isCompleted) activeSessions++;
  });
  console.log(`Active sessions: ${activeSessions}`);
  process.exit(0);
}
run();

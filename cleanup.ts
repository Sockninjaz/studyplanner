import mongoose from 'mongoose';
import Exam from './src/models/Exam';
import StudySession from './src/models/StudySession';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
let mongoUri = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.substring('MONGODB_URI='.length).replace(/['"]/g, '').trim();
      break;
    }
  }
}

async function runCleanup() {
  if (!mongoUri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  const exams = await Exam.find();
  let deleted = 0;
  for (const exam of exams) {
    const validChapters = (exam.studyMaterials || []).map((m: any) => m.chapter.toLowerCase());
    const sessions = await StudySession.find({ exam: exam._id, isCompleted: true });
    
    const sessionsToDelete = [];
    for (const s of sessions) {
      const titleLower = s.title.toLowerCase();
      const matches = validChapters.some((ch: string) => titleLower.includes(ch) || ch.includes(titleLower.replace(/^(study: )?(.*?)( \- )?/, '').trim()));
      if (!matches && !titleLower.includes('review')) {
        sessionsToDelete.push(s._id);
      }
    }
    
    if (sessionsToDelete.length > 0) {
      console.log(`Exam ${exam.subject}: Deleting ${sessionsToDelete.length} orphaned completed sessions`);
      await StudySession.deleteMany({ _id: { $in: sessionsToDelete } });
      deleted += sessionsToDelete.length;
    }
  }
  console.log(`Cleanup done. Deleted ${deleted} orphaned sessions.`);
  process.exit(0);
}
runCleanup();

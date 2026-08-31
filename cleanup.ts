const mongoose = require('mongoose');
const Exam = require('./src/models/Exam').default;
const StudySession = require('./src/models/StudySession').default;
require('dotenv').config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exams = await Exam.find();
  let deleted = 0;
  for (const exam of exams) {
    const validChapters = exam.studyMaterials.map(m => m.chapter.toLowerCase());
    const sessions = await StudySession.find({ exam: exam._id, isCompleted: true });
    
    const sessionsToDelete = [];
    for (const s of sessions) {
      const titleLower = s.title.toLowerCase();
      const matches = validChapters.some(ch => titleLower.includes(ch) || ch.includes(titleLower.replace(/^(study: )?(.*?)( \- )?/, '').trim()));
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
run();

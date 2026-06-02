import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exams = await mongoose.connection.db.collection('exams').find({}).toArray();
  console.log(exams.map(e => ({ id: e._id, subject: e.subject, studyMaterials: e.studyMaterials.length })));
  process.exit(0);
}
run();

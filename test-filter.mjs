import mongoose from 'mongoose';
const MONGODB_URI = "mongodb://markovatchkov_db_user:AZYra6hPd9YDpCOw@ac-dutbnxt-shard-00-00.hlxmpbo.mongodb.net:27017,ac-dutbnxt-shard-00-01.hlxmpbo.mongodb.net:27017,ac-dutbnxt-shard-00-02.hlxmpbo.mongodb.net:27017/studyplanner?ssl=true&replicaSet=atlas-3jpia2-shard-0&authSource=admin&retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(MONGODB_URI);
  const exam = await mongoose.connection.db.collection('exams').findOne({ subject: 'scheikunde' });
  const sessions = await mongoose.connection.db.collection('studysessions').find({ exam: exam._id }).toArray();
  
  console.log("Exam ID:", exam._id.toString());
  console.log("Session Exam ID:", sessions[0].exam.toString());
  console.log("Are they equal?", exam._id.toString() === sessions[0].exam.toString());
  
  const forceRegenerateExamId = exam._id.toString();
  const filtered = sessions.filter(s => s.exam.toString() !== forceRegenerateExamId);
  console.log("Filtered count (should be 0):", filtered.length, "Original count:", sessions.length);
  process.exit(0);
}
run();

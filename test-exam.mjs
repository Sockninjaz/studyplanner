import mongoose from 'mongoose';
const MONGODB_URI = "mongodb://markovatchkov_db_user:AZYra6hPd9YDpCOw@ac-dutbnxt-shard-00-00.hlxmpbo.mongodb.net:27017,ac-dutbnxt-shard-00-01.hlxmpbo.mongodb.net:27017,ac-dutbnxt-shard-00-02.hlxmpbo.mongodb.net:27017/studyplanner?ssl=true&replicaSet=atlas-3jpia2-shard-0&authSource=admin&retryWrites=true&w=majority";
async function run() {
  await mongoose.connect(MONGODB_URI);
  const exams = await mongoose.connection.db.collection('exams').find({}).toArray();
  for (const exam of exams) {
    const sessions = await mongoose.connection.db.collection('studysessions').find({ exam: exam._id }).toArray();
    console.log(`Exam: ${exam.subject} | Date: ${exam.date} | Materials: ${exam.studyMaterials?.length} | Sessions: ${sessions.length}`);
    if (sessions.length > 0) {
      console.log(`  First session: ${sessions[0].title}`);
      console.log(`  Last session: ${sessions[sessions.length-1].title}`);
    }
  }
  process.exit(0);
}
run();

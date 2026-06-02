const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const exams = await mongoose.connection.db.collection('exams').find({}).toArray();
  const sessions = await mongoose.connection.db.collection('studysessions').find({ exam: exams[0]._id }).toArray();
  console.log('Exam:', exams[0]._id, exams[0].subject, 'Materials:', exams[0].studyMaterials.length);
  console.log('Sessions:', sessions.length, 'example:', sessions[0]?.title);
  process.exit(0);
}
run();

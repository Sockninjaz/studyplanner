import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');
let mongoUri = '';
for (const line of lines) {
  if (line.startsWith('MONGODB_URI=')) {
    mongoUri = line.substring('MONGODB_URI='.length).replace(/['"]/g, '').trim();
    break;
  }
}

async function checkExams() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');
  
  // Need to import Exam model
  const ExamSchema = new mongoose.Schema({
    subject: String,
    rawMaterialText: String,
    originalFileName: String,
  }, { strict: false });
  
  const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
  
  const latestExams = await Exam.find().sort({ _id: -1 }).limit(3);
  
  for (const exam of latestExams) {
    console.log(`Exam: ${exam.subject}`);
    console.log(`- Created At: ${exam._id.getTimestamp()}`);
    console.log(`- Has rawMaterialText: ${!!exam.rawMaterialText}`);
    console.log(`- Text length: ${exam.rawMaterialText?.length || 0}`);
    console.log(`- File name: ${exam.originalFileName}`);
    console.log('---');
  }
  
  process.exit(0);
}

checkExams();

import mongoose, { Document, Schema } from 'mongoose';

export interface IExam extends Document {
  subject: string;
  date: Date;
  user: mongoose.Types.ObjectId;
}

const ExamSchema: Schema = new Schema({
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export default mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema);

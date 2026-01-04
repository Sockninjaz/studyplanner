import mongoose, { Document, Schema } from 'mongoose';

export interface IChecklistItem {
  task: string;
  completed: boolean;
}

export interface IStudySession extends Document {
  title: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  isCompleted: boolean;
  checklist: IChecklistItem[];
  user: mongoose.Types.ObjectId;
  exam?: mongoose.Types.ObjectId;
}

const ChecklistItemSchema: Schema = new Schema({
  task: { type: String, required: true },
  completed: { type: Boolean, required: true, default: false },
});

const StudySessionSchema: Schema = new Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isCompleted: { type: Boolean, required: true, default: false },
  checklist: [ChecklistItemSchema],
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },
});

export default mongoose.models.StudySession || mongoose.model<IStudySession>('StudySession', StudySessionSchema);

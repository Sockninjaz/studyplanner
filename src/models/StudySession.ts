import mongoose, { Document, Schema } from 'mongoose';

export interface IChecklistItem {
  task: string;
  completed: boolean;
}

export interface ITask {
  id: string;
  text: string;
  completed: boolean;
  sessionsCompleted: number;
}

export interface IStudySession extends Document {
  title: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  isCompleted: boolean;
  checklist: IChecklistItem[];
  tasks: ITask[];
  notes?: string;
  user: mongoose.Types.ObjectId;
  exam?: mongoose.Types.ObjectId;
}

const ChecklistItemSchema: Schema = new Schema({
  task: { type: String, required: true },
  completed: { type: Boolean, required: true, default: false },
});

const TaskSchema: Schema = new Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, required: true, default: false },
  sessionsCompleted: { type: Number, required: true, default: 0 },
});

const StudySessionSchema: Schema = new Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isCompleted: { type: Boolean, required: true, default: false },
  checklist: [ChecklistItemSchema],
  tasks: [TaskSchema],
  notes: { type: String },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },
});

export default mongoose.models.StudySession || mongoose.model<IStudySession>('StudySession', StudySessionSchema);

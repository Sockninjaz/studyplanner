import mongoose, { Document, Schema } from 'mongoose';

export interface IStudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
  completed: boolean;
}

export interface IExam extends Document {
  subject: string;
  date: Date;
  user: mongoose.Types.ObjectId;
  studyMaterials: IStudyMaterial[];
}

const StudyMaterialSchema = new Schema<IStudyMaterial>({
  chapter: { type: String, required: true },
  difficulty: { type: Number, required: true, min: 1, max: 5 },
  confidence: { type: Number, required: true, min: 1, max: 5 },
  completed: { type: Boolean, default: false },
});

const ExamSchema: Schema = new Schema({
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studyMaterials: [StudyMaterialSchema],
});

export default mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema);

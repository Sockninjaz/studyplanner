import mongoose, { Document, Schema } from 'mongoose';

export interface IStudyMaterial {
  chapter: string;
  difficulty: number;
  confidence: number;
  user_estimated_total_hours: number;
  completed: boolean;
}

export interface IExam extends Document {
  subject: string;
  date: Date;
  user: mongoose.Types.ObjectId;
  studyMaterials: IStudyMaterial[];
  can_study_after_exam: boolean;
}

const StudyMaterialSchema = new Schema<IStudyMaterial>({
  chapter: { type: String, required: true },
  difficulty: { type: Number, required: true, min: 1, max: 5 },
  confidence: { type: Number, required: true, min: 1, max: 5 },
  user_estimated_total_hours: { type: Number, required: true, default: 5 },
  completed: { type: Boolean, default: false },
});

const ExamSchema: Schema = new Schema({
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studyMaterials: [StudyMaterialSchema],
  can_study_after_exam: { type: Boolean, default: false },
  color: { type: String },
}, { timestamps: true });

export default mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema);

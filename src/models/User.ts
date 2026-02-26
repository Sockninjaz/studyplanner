import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  // Note: Password will be hashed and should not be stored in plain text
  password?: string;
  daily_study_limit?: number; // Maximum study hours per day
  soft_daily_limit?: number; // Preferred study hours per day (default 2)
  adjustment_percentage?: number; // Max percentage adjustment for difficulty/confidence (default: 25)
  session_duration?: number; // Duration of each study session in minutes (default: 30)
  enable_daily_limits?: boolean; // Whether to enforce daily maximums (default 2)
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  daily_study_limit: { type: Number, default: 4, min: 1, max: 12 },
  soft_daily_limit: { type: Number, default: 2, min: 1, max: 12 },
  adjustment_percentage: { type: Number, default: 25, min: 0, max: 25 },
  session_duration: { type: Number, default: 30, min: 15, max: 120 },
  enable_daily_limits: { type: Boolean, default: true },
  studySessions: [{ type: Schema.Types.ObjectId, ref: 'StudySession' }],
  exams: [{ type: Schema.Types.ObjectId, ref: 'Exam' }],
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

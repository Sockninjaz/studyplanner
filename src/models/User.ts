import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  // Note: Password will be hashed and should not be stored in plain text
  password?: string; 
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  studySessions: [{ type: Schema.Types.ObjectId, ref: 'StudySession' }],
  exams: [{ type: Schema.Types.ObjectId, ref: 'Exam' }],
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

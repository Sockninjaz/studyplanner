import mongoose, { Document, Schema } from 'mongoose';

export interface IOnboardingProfile {
  country?: string;
  countryName?: string;
  region?: string;
  regionName?: string;
  academicTier?: string;
  academicTierLabel?: string;
  grade?: string;
  gradeLabel?: string;
  examBoard?: string;
  examBoardLabel?: string;
  completedAt?: Date;
}

export interface IUser extends Document {
  name?: string;
  email: string;
  // Note: Password will be hashed and should not be stored in plain text
  password?: string;
  daily_study_limit?: number; // Maximum study hours per day
  soft_daily_limit?: number; // Preferred study hours per day (default 2)
  adjustment_percentage?: number; // Max percentage adjustment for difficulty/confidence (default: 25)
  session_duration?: number; // Duration of each study session in minutes (default: 30)
  enable_daily_limits?: boolean; // Whether to enforce daily maximums (default 2)
  openai_api_key?: string; // BYOK (Bring Your Own Key) for OpenAI
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  onboardingProfile?: IOnboardingProfile;
  // Remembered subject textbooks (e.g. { subject: "Natuurkunde", textbook: "Pulsar 3e editie" })
  subject_textbooks?: Array<{
    subject: string;
    textbook: string;
    updatedAt?: Date;
  }>;
  // Share & Parent updates (Pillar 1 & 3)
  share_token?: string;
  share_token_created_at?: Date;
  parent_emails?: string[];
  // Subscription & Pro tier (Pillar 4)
  is_pro?: boolean;
  subscription_status?: 'free' | 'active' | 'past_due' | 'canceled';
  valid_until?: Date | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  daily_study_limit: { type: Number, default: 4, min: 1, max: 12 },
  soft_daily_limit: { type: Number, default: 2, min: 1, max: 12 },
  adjustment_percentage: { type: Number, default: 25, min: 0, max: 25 },
  session_duration: { type: Number, default: 30, min: 15, max: 120 },
  enable_daily_limits: { type: Boolean, default: true },
  openai_api_key: { type: String, select: false },
  studySessions: [{ type: Schema.Types.ObjectId, ref: 'StudySession' }],
  exams: [{ type: Schema.Types.ObjectId, ref: 'Exam' }],
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  onboardingProfile: {
    country: { type: String },
    countryName: { type: String },
    region: { type: String },
    regionName: { type: String },
    academicTier: { type: String },
    academicTierLabel: { type: String },
    grade: { type: String },
    gradeLabel: { type: String },
    examBoard: { type: String },
    examBoardLabel: { type: String },
    completedAt: { type: Date },
  },
  // Remembered textbooks per subject
  subject_textbooks: [{
    subject: { type: String, required: true },
    textbook: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  }],
  // Secure unguessable share token for read-only parent route
  share_token: { type: String, unique: true, sparse: true, index: true },
  share_token_created_at: { type: Date },
  parent_emails: [{ type: String, lowercase: true, trim: true }],
  // Subscription attributes
  is_pro: { type: Boolean, default: false },
  subscription_status: { 
    type: String, 
    enum: ['free', 'active', 'past_due', 'canceled'], 
    default: 'free' 
  },
  valid_until: { type: Date, default: null },
  stripe_customer_id: { type: String, sparse: true, index: true },
  stripe_subscription_id: { type: String, sparse: true },
}, { timestamps: true });

if (mongoose.models.User) {
  delete mongoose.models.User;
}

export default mongoose.model<IUser>('User', UserSchema);

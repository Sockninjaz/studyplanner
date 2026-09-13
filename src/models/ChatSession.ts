import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  studySession?: mongoose.Types.ObjectId;
  createdAt: Date;
  inlineChats?: IThreadMessage[];
}

export interface IThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IChatSession extends Document {
  user: mongoose.Types.ObjectId;
  exam: mongoose.Types.ObjectId;
  aiIntegration: string;
  messages: IMessage[];
}

const ThreadMessageSchema = new Schema<IThreadMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  studySession: { type: Schema.Types.ObjectId, ref: 'StudySession' },
  createdAt: { type: Date, default: Date.now },
  inlineChats: [ThreadMessageSchema],
});

const ChatSessionSchema = new Schema<IChatSession>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  aiIntegration: { type: String, required: true, default: 'openai' },
  messages: [MessageSchema],
}, { timestamps: true });

export default mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

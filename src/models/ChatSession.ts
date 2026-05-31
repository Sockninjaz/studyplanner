import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface IChatSession extends Document {
  user: mongoose.Types.ObjectId;
  exam: mongoose.Types.ObjectId;
  aiIntegration: string;
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ChatSessionSchema = new Schema<IChatSession>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  aiIntegration: { type: String, required: true, default: 'openai' },
  messages: [MessageSchema],
}, { timestamps: true });

export default mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  date: Date;
  isCompleted: boolean;
  notes?: string;
  tasks?: Array<{
    id: string;
    text: string;
    completed: boolean;
    sessionsCompleted: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
    tasks: [
      {
        id: String,
        text: String,
        completed: Boolean,
        sessionsCompleted: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ userId: 1, date: 1 });

export default mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

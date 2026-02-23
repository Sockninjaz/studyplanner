import mongoose, { Document, Schema } from 'mongoose';

export interface IBlockedDay extends Document {
  user: mongoose.Types.ObjectId;
  date: Date; // Stored as UTC midnight, e.g. 2026-02-15T00:00:00.000Z
}

const BlockedDaySchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
});

// Compound index: one blocked entry per user per date
BlockedDaySchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.models.BlockedDay || mongoose.model<IBlockedDay>('BlockedDay', BlockedDaySchema);

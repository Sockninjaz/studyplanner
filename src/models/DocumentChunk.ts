import mongoose, { Document, Schema } from 'mongoose';

export interface IDocumentChunk extends Document {
  exam: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  sectionTitle: string;
  chunkIndex: number;
  embedding: number[];
}

const DocumentChunkSchema: Schema = new Schema({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  sectionTitle: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  embedding: { type: [Number], required: true },
});

export default mongoose.models.DocumentChunk ||
  mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);

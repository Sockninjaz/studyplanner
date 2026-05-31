import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

/**
 * Splits raw document text into overlapping chunks, respecting § section markers.
 * Returns an array of { text, sectionTitle } objects ready for embedding.
 */
function chunkText(rawText: string): { text: string; sectionTitle: string }[] {
  const chunks: { text: string; sectionTitle: string }[] = [];
  const MAX_CHUNK_CHARS = 1800; // ~450 tokens — safe for embedding model
  const MIN_CHUNK_CHARS = 80;

  // Try splitting by § section markers (handles Dutch biology style: § 9.1, §9.1, § 10, etc.)
  const sectionRegex = /(?=§\s*\d)/;
  const sections = rawText.split(sectionRegex).filter((s) => s.trim().length > MIN_CHUNK_CHARS);

  if (sections.length > 1) {
    // Document has clear § section structure
    for (const section of sections) {
      const lines = section.trim().split('\n');
      const sectionTitle = lines[0].trim().substring(0, 120); // e.g. "§ 9.1 Chemie in Cellen"

      if (section.length <= MAX_CHUNK_CHARS) {
        chunks.push({ text: section.trim(), sectionTitle });
      } else {
        // Section too long — split by paragraphs with overlap
        const paragraphs = section.split(/\n\n+/);
        let current = '';
        for (const para of paragraphs) {
          if (current.length + para.length > MAX_CHUNK_CHARS && current.length > MIN_CHUNK_CHARS) {
            chunks.push({ text: current.trim(), sectionTitle });
            // Overlap: keep last paragraph as context for next chunk
            current = para;
          } else {
            current += '\n\n' + para;
          }
        }
        if (current.trim().length > MIN_CHUNK_CHARS) {
          chunks.push({ text: current.trim(), sectionTitle });
        }
      }
    }
  } else {
    // Fallback: no § markers — split by double newlines (paragraphs)
    const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > MIN_CHUNK_CHARS);
    let current = '';
    let partIndex = 1;
    for (const para of paragraphs) {
      if (current.length + para.length > MAX_CHUNK_CHARS && current.length > MIN_CHUNK_CHARS) {
        chunks.push({ text: current.trim(), sectionTitle: `Part ${partIndex++}` });
        current = para;
      } else {
        current += '\n\n' + para;
      }
    }
    if (current.trim().length > MIN_CHUNK_CHARS) {
      chunks.push({ text: current.trim(), sectionTitle: `Part ${partIndex}` });
    }
  }

  return chunks;
}

/**
 * Chunks the raw text, generates OpenAI embeddings, and stores them in MongoDB.
 * Replaces any existing chunks for this exam.
 */
export async function generateAndStoreChunks(
  rawText: string,
  examId: string,
  userId: string
): Promise<number> {
  const DocumentChunk = (await import('@/models/DocumentChunk')).default;

  // Clear old chunks for this exam
  await DocumentChunk.deleteMany({ exam: examId });

  const chunks = chunkText(rawText);
  if (chunks.length === 0) return 0;

  const texts = chunks.map((c) => c.text);

  // Generate embeddings in one batch (text-embedding-3-small: 1536 dims, very cheap)
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  });

  const docs = chunks.map((chunk, i) => ({
    exam: examId,
    user: userId,
    text: chunk.text,
    sectionTitle: chunk.sectionTitle,
    chunkIndex: i,
    embedding: Array.from(embeddings[i]),
  }));

  await DocumentChunk.insertMany(docs);
  console.log(`[RAG] Stored ${docs.length} chunks for exam ${examId}`);
  return docs.length;
}

/**
 * Retrieves the top-K most relevant chunks for a given query using cosine similarity.
 * Uses MongoDB Atlas $vectorSearch if the index exists, falls back to in-memory if not.
 */
export async function retrieveRelevantChunks(
  query: string,
  examId: string,
  topK = 5
): Promise<{ text: string; sectionTitle: string; score: number }[]> {
  const DocumentChunk = (await import('@/models/DocumentChunk')).default;
  const mongoose = (await import('mongoose')).default;

  // Check if there are any chunks for this exam
  const chunkCount = await DocumentChunk.countDocuments({ exam: examId });
  if (chunkCount === 0) return [];

  // Generate embedding for the query
  const { embedding: queryEmbedding } = await (await import('ai')).embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });

  try {
    // Try Atlas $vectorSearch first
    const results = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: 'document_chunks_vector_index',
          path: 'embedding',
          queryVector: Array.from(queryEmbedding),
          numCandidates: Math.min(chunkCount * 10, 200),
          limit: topK,
          filter: { exam: new mongoose.Types.ObjectId(examId) },
        },
      },
      {
        $project: {
          text: 1,
          sectionTitle: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
    return results;
  } catch (err: any) {
    // Atlas index not set up yet — fallback to in-memory cosine similarity
    console.warn('[RAG] $vectorSearch failed, using in-memory fallback:', err?.message);
    const allChunks = await DocumentChunk.find({ exam: examId })
      .select('text sectionTitle embedding')
      .lean();

    const qVec = Array.from(queryEmbedding);
    const scored = allChunks.map((chunk: any) => {
      const dot = chunk.embedding.reduce((s: number, v: number, i: number) => s + v * qVec[i], 0);
      const magA = Math.sqrt(chunk.embedding.reduce((s: number, v: number) => s + v * v, 0));
      const magB = Math.sqrt(qVec.reduce((s, v) => s + v * v, 0));
      return { text: chunk.text, sectionTitle: chunk.sectionTitle, score: dot / (magA * magB) };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

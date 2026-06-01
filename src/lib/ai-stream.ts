/**
 * Reads a Vercel AI SDK v6 data-stream response and calls onChunk with each text delta.
 * AI SDK data streams send chunks in the format: 0:"text here"\n
 * We parse out just the text content and ignore tool calls/other events.
 */
export async function readAIStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process all complete lines in the buffer
    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      // AI SDK v6 text delta format: 0:"text chunk"
      if (line.startsWith('0:')) {
        try {
          const jsonStr = line.slice(2);
          const text = JSON.parse(jsonStr);
          if (typeof text === 'string') {
            onChunk(text);
          }
        } catch {}
      }
    }
  }

  // Process any remaining buffer content
  if (buffer.trim() && buffer.startsWith('0:')) {
    try {
      const text = JSON.parse(buffer.slice(2));
      if (typeof text === 'string') onChunk(text);
    } catch {}
  }
}

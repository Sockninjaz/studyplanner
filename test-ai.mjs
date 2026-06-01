import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      prompt: 'say hello',
    });
    const stream = result.toUIMessageStreamResponse();
    const reader = stream.body.getReader();
    
    for (let i = 0; i < 5; i++) {
      let {value, done} = await reader.read();
      console.log(`CHUNK ${i}:`, new TextDecoder().decode(value));
      if (done) break;
    }
    process.exit(0);
  } catch(e) {
    console.log("ERR", e);
    process.exit(1);
  }
}
run();

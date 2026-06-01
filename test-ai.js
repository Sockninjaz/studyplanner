const { streamText } = require('ai');
const { openai } = require('@ai-sdk/openai');
require('dotenv').config({ path: '.env.local' });

async function run() {
  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      prompt: 'hello',
    });
    console.log(typeof result.toDataStreamResponse);
    console.log(typeof result.toTextStreamResponse);
  } catch(e) {
    console.log("ERR", e);
  }
}
run();

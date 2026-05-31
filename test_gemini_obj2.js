const { generateObject } = require('ai');
const { google } = require('@ai-sdk/google');
const { z } = require('zod');

async function run() {
  try {
    const { object } = await generateObject({
      model: google('gemini-1.5-pro', { useSearchGrounding: true }),
      schema: z.object({
        chapters: z.array(z.string())
      }),
      prompt: 'What are the chapters in the book Chemie Overal VWO 5?'
    });
    console.log("RESPONSE:", object);
  } catch (err) {
    console.error(err.message);
  }
}
run();

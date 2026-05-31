require('dotenv').config({ path: '.env.local' });
const { generateText } = require('ai');
const { google } = require('@ai-sdk/google');

async function run() {
  try {
    const { text } = await generateText({
      model: google('gemini-1.5-pro-latest', { useSearchGrounding: true }),
      prompt: 'What are the chapters in the book Chemie Overal VWO 5?'
    });
    console.log("RESPONSE:", text);
  } catch (err) {
    console.error(err);
  }
}
run();

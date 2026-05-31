import fs from 'fs';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function test() {
  try {
    // Read API key from .env.local
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/OPENAI_API_KEY=(.*)/);
    if (match) {
      process.env.OPENAI_API_KEY = match[1].trim();
    }

    const aiResponse = await generateText({
      model: openai('gpt-4o'),
      messages: [{
        role: 'user', 
        content: `You are a helpful study planner assistant. A user has given you a brief textbook title or study material description: "Chemie overal: TW3 H1 t/m H12 paragrafen 1, 2 en 5" for the subject "scheikunde".
The user is in: Country: Netherlands | Track/Tier: VWO | Grade/Year: VWO 5

CRITICAL: Use this information (especially Grade and Track) to output the EXACT authentic Table of Contents for this specific book and edition from your vast internal knowledge.
Output the chapters.`
      }]
    });
    console.log("GPT-4o output:");
    console.log(aiResponse.text);
  } catch(e) {
    console.error(e);
  }
}

test();

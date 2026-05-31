import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  try {
    const aiResponse = await generateText({
      model: openai('gpt-4o'),
      messages: [{
        role: 'user', 
        content: `You are a helpful study planner assistant. A user has given you a brief textbook title or study material description: "Chemie overal: TW3 H1 t/m H12 paragrafen 1, 2 en 5" for the subject "scheikunde".
The user is in: Country: Netherlands | Track/Tier: VWO | Grade/Year: VWO 5

CRITICAL: Use this information (especially Grade and Track) to output the EXACT correct authentic Table of Contents for this specific book from your vast internal knowledge.
Output the chapters.`
      }]
    });
    console.log(aiResponse.text);
  } catch(e) {
    console.error(e);
  }
}

test();

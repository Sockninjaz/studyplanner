const { generateText, tool } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { z } = require('zod');
const google = require('googlethis');

async function run() {
  try {
    const { text, steps } = await generateText({
      model: openai('gpt-4o'),
      maxSteps: 3,
      tools: {
        searchWeb: tool({
          description: 'Search the web for information, such as textbook tables of contents.',
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            console.log(`[Tool] Searching for: ${query}`);
            const options = { page: 0, safe: false, additional_params: { hl: 'en' } };
            const response = await google.search(query, options);
            return response.results.map(r => r.title + '\n' + r.description).join('\n\n');
          }
        })
      },
      prompt: 'Find the table of contents for the book "Chemie Overal VWO 5" and list the chapters.'
    });
    console.log("FINAL ANSWER:", text);
  } catch (err) {
    console.error(err);
  }
}
run();

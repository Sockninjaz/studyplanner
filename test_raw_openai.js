const OpenAI = require('openai');
const google = require('googlethis');

async function run() {
  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Find the table of contents for the book 'Chemie Overal VWO 5' and list the chapters." }],
      tools: [
        {
          type: "function",
          function: {
            name: "searchWeb",
            description: "Search the web for information, such as textbook tables of contents.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "The search query" }
              },
              required: ["query"],
              additionalProperties: false
            }
          }
        }
      ]
    });
    console.log("TOOL CALLS:", response.choices[0].message.tool_calls);
  } catch (err) {
    console.error(err);
  }
}
run();

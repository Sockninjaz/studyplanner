const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      tools: [{ googleSearch: {} }],
    });
    
    const result = await model.generateContent("Find the table of contents for the book 'Chemie Overal VWO 5' and list the chapters.");
    console.log("FINAL ANSWER:", result.response.text());
  } catch (err) {
    console.error(err);
  }
}
run();

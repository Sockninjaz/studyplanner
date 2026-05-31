import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyCPeSjdx5ZehsyI-uQthBwDvFqeNT8e_SM';
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    const models = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await models.json();
    console.log("Available models:");
    data.models.forEach((m: any) => {
      if (m.name.includes('gemini')) {
        console.log(m.name, m.supportedGenerationMethods);
      }
    });
  } catch (e) {
    console.error(e);
  }
}

test();

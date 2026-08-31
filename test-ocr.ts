import { extractTextFromMultimodal } from './src/lib/ai/aiClient';
import fs from 'fs';

async function test() {
  // Create a 1x1 black png
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const buffer = Buffer.from(pngBase64, 'base64');
  try {
    const text = await extractTextFromMultimodal(buffer, 'image/png');
    console.log("OCR SUCCESS:", text);
  } catch (err) {
    console.error("OCR ERROR:", err);
  }
}
test();

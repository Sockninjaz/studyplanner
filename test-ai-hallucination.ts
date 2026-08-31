import { generateStructuredOutput } from './src/lib/ai/aiClient.js';
import { MATERIAL_ANALYSIS_PROMPT } from './src/lib/ai/prompts.js';
import { z } from 'zod';

const StudyMaterialSchema = z.object({
  chapters: z.array(z.object({
    chapter: z.string(),
    difficulty: z.number(),
    confidence: z.number(),
    user_estimated_total_hours: z.number(),
  })),
  summary: z.string(),
  isSuggestedFallback: z.boolean(),
  totalEstimatedHours: z.number(),
});

const userMessage = `Analyze the following study material for the subject "wiskunde" (exam date: TBD).

First estimate the TOTAL realistic study hours for the whole document, then divide into chapters.
The sum of all chapter hours MUST equal the totalEstimatedHours.
Be highly realistic and do not overestimate. Most single documents only take 1-5 hours to study.

--- STUDY MATERIAL ---
Subject: wiskunde
Material: getal en ruimte wis a, material: h6 h9 h11 h4

Authentic Textbook Contents Found in Database:
--- VWO 4 ---
H1 Getallen en variabelen
H2 Combinatoriek
H3 Verbanden en grafieken
H4 Handig tellen
H5 Lineaire verbanden
H6 Machtsverbanden
H7 Kansrekening
H8 Rijen en veranderingen

--- VWO 5 ---
H9 Kansverdelingen
H10 Differentiëren
H11 Het toetsen van hypothesen

--- VWO 6 ---
H12 Rijen
H13 Allerlei formules
H14 Toepassingen van de differentiaalrekening
H15 Examentraining

CRITICAL INSTRUCTION: You MUST use the exact word-for-word chapter titles from the database above that match the user's requested chapters. Do NOT invent, translate, or rephrase any chapters. Do NOT mix them with international curriculum standards. If the user asks for H1 to H12, pick H1 to H12 exactly as they are named above in the provided authentic contents.
--- END MATERIAL ---`;

async function main() {
  console.log('Sending to AI...');
  const result = await generateStructuredOutput(
    MATERIAL_ANALYSIS_PROMPT,
    userMessage,
    StudyMaterialSchema,
    'study_material_analysis'
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

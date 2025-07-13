// src/ai/flows/text-to-schematic.ts
'use server';

/**
 * @fileOverview Converts text into a pixel art schematic suitable for Vintage Story.
 *
 * - textToSchematic - A function that handles the text conversion process.
 * - TextToSchematicInput - The input type for the textToSchematic function.
 * - TextToSchematicOutput - The return type for the textToSchematic function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TextToSchematicInputSchema = z.object({
  text: z.string().describe('The text to convert to a schematic.'),
  font: z.string().describe('The font family to use for the text.'),
  fontSize: z.number().describe('The font size in pixels.'),
});
export type TextToSchematicInput = z.infer<typeof TextToSchematicInputSchema>;

const TextToSchematicOutputSchema = z.object({
  schematicData: z.string().describe('The generated schematic data for Vintage Story.'),
});
export type TextToSchematicOutput = z.infer<typeof TextToSchematicOutputSchema>;

export async function textToSchematic(input: TextToSchematicInput): Promise<TextToSchematicOutput> {
  return textToSchematicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'textToSchematicPrompt',
  input: {schema: TextToSchematicInputSchema},
  output: {schema: TextToSchematicOutputSchema},
  prompt: `You are an expert in converting text into pixel art schematics for the game Vintage Story.

  Take the following text and properties and create schematic data that represents the text as pixel art using Vintage Story blocks.

  Text: {{{text}}}
  Font Family: {{{font}}}
  Font Size: {{{fontSize}}}px
  `,
});

const textToSchematicFlow = ai.defineFlow(
  {
    name: 'textToSchematicFlow',
    inputSchema: TextToSchematicInputSchema,
    outputSchema: TextToSchematicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

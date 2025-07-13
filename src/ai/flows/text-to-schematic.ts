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
  schematicData: z.string().describe('The generated schematic data for Vintage Story in a single string.'),
  width: z.number().describe('The width of the generated pixel art in pixels.'),
  height: z.number().describe('The height of the generated pixel art in pixels.'),
  pixels: z.array(z.boolean()).describe('A flattened array of booleans representing the pixel data. True for a filled pixel, false for an empty one.'),
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

  Your task is to take the user's text, font, and font size, and convert it into a monochrome pixel art representation. The output must be a JSON object conforming to the output schema.

  1.  **Determine Dimensions**: Calculate the width and height of the bounding box required for the text with the given font properties.
  2.  **Rasterize Text**: Generate a monochrome (on/off) pixel grid for the text. 'true' represents a filled pixel (ink), and 'false' represents an empty pixel (background).
  3.  **Flatten Pixel Data**: Create a one-dimensional array ('pixels') from the 2D pixel grid in row-major order (top to bottom, left to right). The length of this array must be exactly width * height.
  4.  **Generate Schematic Data**: Create a text-based schematic data string suitable for Vintage Story that represents the generated pixel art. This should be a compact representation.
  5.  **Format Output**: Return a JSON object with 'schematicData', 'width', 'height', and the 'pixels' array.

  **User Input:**
  - Text: \`{{{text}}}\`
  - Font Family: \`{{{font}}}\`
  - Font Size: \`{{{fontSize}}}px\`

  Generate the pixel art and the corresponding schematic data now.`,
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

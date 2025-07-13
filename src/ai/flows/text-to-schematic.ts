// src/ai/flows/text-to-schematic.ts
'use server';

/**
 * @fileOverview Converts text into a pixel art schematic suitable for Vintage Story.
 *
 * - textToSchematic - A function that handles the text conversion process.
 */

import {ai} from '@/ai/genkit';
import {
  TextToSchematicInputSchema,
  type TextToSchematicInput,
  SchematicOutputSchema,
  type SchematicOutput
} from './schemas';

export type { TextToSchematicInput, SchematicOutput };


export async function textToSchematic(input: TextToSchematicInput): Promise<SchematicOutput> {
  return textToSchematicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'textToSchematicPrompt',
  input: {schema: TextToSchematicInputSchema},
  output: {schema: SchematicOutputSchema},
  prompt: `You are an expert in converting text into pixel art schematics for the game Vintage Story.

Your task is to take the user's text, font, and font size, and convert it into a monochrome pixel art representation. The output must be a JSON object conforming to the output schema.

1.  **Determine Dimensions**: Calculate the width and height of the bounding box required for the text with the given font properties. The dimensions should be multiples of 16 if the text is larger than 16x16.
2.  **Rasterize Text**: Generate a monochrome (on/off) pixel grid for the text. 'true' represents a filled pixel (ink), and 'false' represents an empty pixel (background).
3.  **Flatten Pixel Data**: Create a one-dimensional array ('pixels') from the 2D pixel grid in row-major order (top to bottom, left to right). The length of this array must be exactly width * height.
4.  **Generate Schematic Data**: Create a compact text-based schematic data string suitable for Vintage Story that represents the generated pixel art. This must be a simple, non-empty string like "Schematic for: [text]".
5.  **Format Output**: Return a JSON object with all four required fields: 'schematicData', 'width', 'height', and the 'pixels' array. Ensure all fields are present and valid.

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
    outputSchema: SchematicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

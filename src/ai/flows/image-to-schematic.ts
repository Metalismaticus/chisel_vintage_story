// src/ai/flows/image-to-schematic.ts
'use server';

/**
 * @fileOverview Converts an image into a pixel art schematic suitable for Vintage Story.
 *
 * - imageToSchematic - A function that handles the image conversion process.
 */

import {ai} from '@/ai/genkit';
import {
  ImageToSchematicInputSchema, 
  type ImageToSchematicInput, 
  SchematicOutputSchema, 
  type SchematicOutput
} from './schemas';

export type { ImageToSchematicInput, SchematicOutput };


export async function imageToSchematic(input: ImageToSchematicInput): Promise<SchematicOutput> {
  return imageToSchematicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'imageToSchematicPrompt',
  input: {schema: ImageToSchematicInputSchema},
  output: {schema: SchematicOutputSchema},
  prompt: `You are an expert in converting images into pixel art schematics for the game Vintage Story.

Your task is to take the user's image and convert it into a monochrome pixel art representation. The output must be a JSON object conforming to the output schema.

1.  **Analyze Image**: Determine the best way to represent the image as monochrome pixel art.
2.  **Determine Dimensions**: Calculate the width and height of the resulting pixel art.
3.  **Rasterize Image**: Generate a monochrome (on/off) pixel grid for the image. 'true' represents a filled pixel (ink), and 'false' represents an empty pixel (background).
4.  **Flatten Pixel Data**: Create a one-dimensional array ('pixels') from the 2D pixel grid in row-major order (top to bottom, left to right). The length of this array must be exactly width * height.
5.  **Generate Schematic Data**: Create a compact text-based schematic data string suitable for Vintage Story that represents the generated pixel art. This can be a simple string like "Schematic for: image".
6.  **Format Output**: Return a JSON object with all four required fields: 'schematicData', 'width', 'height', and the 'pixels' array. Ensure all fields are present.

**User Input:**
- Photo: {{media url=photoDataUri}}

Generate the pixel art and the corresponding schematic data now.`,
});

const imageToSchematicFlow = ai.defineFlow(
  {
    name: 'imageToSchematicFlow',
    inputSchema: ImageToSchematicInputSchema,
    outputSchema: SchematicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

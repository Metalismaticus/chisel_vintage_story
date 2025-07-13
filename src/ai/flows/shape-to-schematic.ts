// src/ai/flows/shape-to-schematic.ts
'use server';

/**
 * @fileOverview Converts a geometric shape into a pixel art schematic suitable for Vintage Story.
 *
 * - shapeToSchematic - A function that handles the shape generation process.
 */

import {ai} from '@/ai/genkit';
import {
  ShapeToSchematicInputSchema,
  type ShapeToSchematicInput,
  SchematicOutputSchema,
  type SchematicOutput
} from './schemas';

export type { ShapeToSchematicInput, SchematicOutput };


export async function shapeToSchematic(input: ShapeToSchematicInput): Promise<SchematicOutput> {
  return shapeToSchematicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'shapeToSchematicPrompt',
  input: {schema: ShapeToSchematicInputSchema},
  output: {schema: SchematicOutputSchema},
  prompt: `You are an expert in generating pixel art schematics of geometric shapes for the game Vintage Story.

Your task is to take the user's desired shape and dimensions, and convert it into a monochrome pixel art representation. The output must be a JSON object conforming to the output schema.

1.  **Determine Dimensions**: Based on the input shape and dimensions, calculate the final width and height of the pixel art bounding box.
2.  **Rasterize Shape**: Generate a monochrome (on/off) pixel grid for the shape. 'true' represents a filled pixel (ink), and 'false' represents an empty pixel (background). For a triangle, it should be an equilateral triangle.
3.  **Flatten Pixel Data**: Create a one-dimensional array ('pixels') from the 2D pixel grid in row-major order (top to bottom, left to right). The length of this array must be exactly width * height.
4.  **Generate Schematic Data**: Create a compact text-based schematic data string suitable for Vintage Story that represents the generated pixel art. This can be a simple string like "Schematic for: [shape] with [dimensions]".
5.  **Format Output**: Return a JSON object with all four required fields: 'schematicData', 'width', 'height', and the 'pixels' array. Ensure all fields are present.

**User Input:**
- Shape: \`{{{shape}}}\`
- Dimensions: \`{{jsonEncode dimensions}}\`

Generate the pixel art and the corresponding schematic data now.`,
});

const shapeToSchematicFlow = ai.defineFlow(
  {
    name: 'shapeToSchematicFlow',
    inputSchema: ShapeToSchematicInputSchema,
    outputSchema: SchematicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

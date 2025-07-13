// src/ai/flows/image-to-schematic.ts
'use server';

/**
 * @fileOverview Converts an image into a pixel art schematic suitable for Vintage Story.
 *
 * - imageToSchematic - A function that handles the image conversion process.
 * - ImageToSchematicInput - The input type for the imageToSchematic function.
 * - ImageToSchematicOutput - The return type for the imageToSchematic function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImageToSchematicInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to convert to a schematic, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ImageToSchematicInput = z.infer<typeof ImageToSchematicInputSchema>;

const ImageToSchematicOutputSchema = z.object({
  schematicData: z.string().describe('The generated schematic data for Vintage Story.'),
});
export type ImageToSchematicOutput = z.infer<typeof ImageToSchematicOutputSchema>;

export async function imageToSchematic(input: ImageToSchematicInput): Promise<ImageToSchematicOutput> {
  return imageToSchematicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'imageToSchematicPrompt',
  input: {schema: ImageToSchematicInputSchema},
  output: {schema: ImageToSchematicOutputSchema},
  prompt: `You are an expert in converting images into pixel art schematics for the game Vintage Story, which uses a block grid with each block divisible into 16x16 pixels.

  Take the image and create schematic data that represents the image as pixel art using Vintage Story blocks. The schematic data should be optimized for the game's block grid.

  Photo: {{media url=photoDataUri}}
  `,
});

const imageToSchematicFlow = ai.defineFlow(
  {
    name: 'imageToSchematicFlow',
    inputSchema: ImageToSchematicInputSchema,
    outputSchema: ImageToSchematicOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

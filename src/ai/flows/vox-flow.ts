'use server';
/**
 * @fileOverview A flow for generating 3D voxel models (.vox format).
 *
 * - generateVoxModel - A function that handles the voxel model generation.
 * - GenerateVoxModelInput - The input type for the generateVoxModel function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';
import { voxToSchematic, type VoxShape, type SchematicOutput } from '@/lib/schematic-utils';

const VoxShapeSchema = z.union([
    z.object({ type: z.literal('cuboid'), width: z.number(), height: z.number(), depth: z.number() }),
    z.object({ type: z.literal('sphere'), radius: z.number() }),
    z.object({ type: z.literal('pyramid'), base: z.number(), height: z.number() }),
    z.object({ type: z.literal('column'), radius: z.number(), height: z.number() }),
    z.object({ type: z.literal('cone'), radius: z.number(), height: z.number() }),
    z.object({ type: z.literal('arch'), width: z.number(), height: z.number(), depth: z.number() }),
    z.object({ type: z.literal('disk'), radius: z.number(), height: z.number() }),
]);

const GenerateVoxModelInputSchema = z.object({
  shape: VoxShapeSchema.describe("The 3D shape to generate."),
});

export type GenerateVoxModelInput = z.infer<typeof GenerateVoxModelInputSchema>;

// This is the main function that will be called from the client.
export async function generateVoxModel(input: GenerateVoxModelInput): Promise<SchematicOutput> {
  return generateVoxModelFlow(input);
}

const generateVoxModelFlow = ai.defineFlow(
  {
    name: 'generateVoxModelFlow',
    inputSchema: GenerateVoxModelInputSchema,
    outputSchema: z.custom<SchematicOutput>(),
  },
  async ({ shape }) => {
    try {
      // The core logic is in schematic-utils, which is now safe to run on the server.
      const result = voxToSchematic(shape as VoxShape);
      
      // The voxData is a Uint8Array. We need to convert it to a Base64 string
      // to safely send it over JSON.
      if (result.voxData) {
          const b64 = Buffer.from(result.voxData).toString('base64');
          // We modify the result to include the base64 string, which the client will decode.
          // @ts-ignore - we are adding a property that is not in the original type
          result.voxDataB64 = b64;
          delete result.voxData; // remove the large binary data
      }

      return result;
    } catch (error) {
      console.error("Error in generateVoxModelFlow:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate VOX model: ${error.message}`);
      }
      throw new Error("An unknown error occurred while generating the VOX model.");
    }
  }
);

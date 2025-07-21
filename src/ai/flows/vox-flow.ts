'use server';
/**
 * @fileOverview A Genkit flow for generating .vox models of 3D shapes.
 *
 * - generateVoxFlow - A function that handles the .vox generation process.
 * - VoxOutput - The return type for the generateVoxFlow function.
 */

import { ai } from '@/ai/genkit';
import { voxToSchematic, type VoxShape } from '@/lib/schematic-utils';
import { z } from 'zod';

// We define the output type here for client-side usage.
export interface VoxOutput {
  schematicData: string;
  width: number;
  height: number;
  isVox: boolean;
  voxData: string; // Base64 encoded string
}

const VoxOutputSchema = z.object({
    schematicData: z.string(),
    width: z.number(),
    height: z.number(),
    isVox: z.boolean(),
    voxData: z.string(),
});


// This is the main exported function that the client will call.
export async function generateVoxFlow(input: VoxShape): Promise<VoxOutput> {
  const result = await voxGenerationFlow(input);

  if (!result.isVox || !result.voxData) {
      throw new Error('Flow did not return valid vox data.');
  }

  // The flow returns voxData as a raw Uint8Array buffer. We need to convert it to a Base64 string for JSON serialization.
  const voxDataB64 = Buffer.from(result.voxData).toString('base64');
  
  return {
      schematicData: result.schematicData,
      width: result.width,
      height: result.height,
      isVox: result.isVox,
      voxData: voxDataB64,
  };
}

// Define the Genkit flow. It takes the shape parameters, generates the .vox file,
// and returns the output including the raw .vox data.
const voxGenerationFlow = ai.defineFlow(
  {
    name: 'voxGenerationFlow',
    inputSchema: z.any(),
    outputSchema: z.any(),
  },
  async (shapeParams: VoxShape) => {
    // Generate the schematic and raw .vox data (Uint8Array)
    const result = voxToSchematic(shapeParams);

    if (!result || !result.voxData) {
      throw new Error('Failed to generate .vox data.');
    }
    
    // Return the final output object. The wrapper will handle the buffer-to-base64 conversion.
    return result;
  }
);

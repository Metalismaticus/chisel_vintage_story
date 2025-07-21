
'use server';
/**
 * @fileOverview A Genkit flow for generating .vox models of 3D shapes.
 *
 * - generateVoxFlow - A function that handles the .vox generation process.
 * - VoxOutput - The return type for the generateVoxFlow function.
 */

import { ai } from '@/ai/genkit';
import { voxToSchematic, type VoxShape } from '@/lib/schematic-utils';

// We define the output type here for client-side usage, but we won't use it in the flow schema
// to avoid the zod dependency issue in the server action environment.
export interface VoxOutput {
  schematicData: string;
  width: number;
  height: number;
  isVox: boolean;
  voxData: string; // Base64 encoded string
}


// This is the main exported function that the client will call.
export async function generateVoxFlow(input: VoxShape): Promise<VoxOutput> {
  // Since the flow now returns `any`, we cast the result to the expected type.
  const result: any = await voxGenerationFlow(input);

  // The flow returns voxData as raw Uint8Array buffer. We need to convert it to a Base64 string for JSON serialization.
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
// We remove inputSchema and outputSchema to avoid using `zod` in this file.
const voxGenerationFlow = ai.defineFlow(
  {
    name: 'voxGenerationFlow',
  },
  async (shapeParams: VoxShape) => {
    // Generate the schematic and raw .vox data (Uint8Array)
    const result = voxToSchematic(shapeParams);

    if (!result || !result.voxData) {
      throw new Error('Failed to generate .vox data.');
    }
    
    // Return the final output object. The Uint8Array will be handled by the wrapper.
    return {
      schematicData: result.schematicData,
      width: result.width,
      height: result.height,
      isVox: true,
      voxData: result.voxData,
    };
  }
);

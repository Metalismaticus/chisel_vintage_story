
'use server';
/**
 * @fileOverview A server action for generating .vox models from text.
 *
 * - generateTextToVoxFlow - A function that handles the text-to-vox generation process.
 * - TextToVoxInput - The input type for the flow.
 * - TextToVoxOutput - The return type for the flow.
 */

import { z } from 'zod';
const writeVox = require('vox-saver');
import type { PaletteColor, TextOrientation } from '@/lib/schematic-utils';

const TextToVoxInputSchema = z.object({
  pixels: z.array(z.boolean()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: z.enum(['extrude', 'engrave']),
  letterDepth: z.number().int().positive(),
  backgroundDepth: z.number().int().min(0),
  engraveDepth: z.number().int().min(0),
  orientation: z.enum(['horizontal', 'vertical-lr']),
});

export type TextToVoxInput = z.infer<typeof TextToVoxInputSchema>;

export interface TextToVoxOutput {
  schematicData: string;
  width: number;
  height: number;
  isVox: boolean;
  voxData: string; // Base64 encoded string
}

function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';
    return `Schematic: ${name} (${width}x${height}${depthInfo})`;
}


export async function generateTextToVoxFlow(input: TextToVoxInput): Promise<TextToVoxOutput> {
  const { 
    pixels, 
    width: textWidth, 
    height: textHeight, 
    mode, 
    letterDepth, 
    backgroundDepth, 
    engraveDepth,
    orientation,
  } = TextToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  // Use a helper function for consistent voxel addition.
  // Y is the vertical axis in our 2D pixel map.
  // We'll map this to the appropriate 3D coordinates based on orientation.
  const addVoxelByOrientation = (px: number, py: number, pz: number) => {
    let x, y, z;
    if (orientation === 'vertical-lr') { // Laying flat on the floor
      x = px;
      y = pz; // Depth becomes the Y (up) axis
      z = py; // Height of text runs along Z
    } else { // Standing up on a wall (horizontal or column)
      x = px;
      y = py;
      z = pz;
    }
    xyziValues.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), i: 1 });
  };
  
  let modelWidth = textWidth;
  let modelHeight = textHeight;
  let modelDepth = 0;

  if (mode === 'extrude') {
    modelDepth = letterDepth;
    for (let py = 0; py < textHeight; py++) {
      for (let px = 0; px < textWidth; px++) {
        if (pixels[py * textWidth + px]) {
          for (let pz = 0; pz < letterDepth; pz++) {
            // We flip the y-axis to match the typical 2D canvas coordinates (top-left 0,0)
            addVoxelByOrientation(px, textHeight - 1 - py, pz);
          }
        }
      }
    }
  } else if (mode === 'engrave') {
    modelDepth = backgroundDepth;
    for (let py = 0; py < textHeight; py++) {
      for (let px = 0; px < textWidth; px++) {
        const isTextPixel = pixels[py * textWidth + px];
        let endDepth = backgroundDepth;
        if (isTextPixel) {
            // For vertical orientation, we engrave from the top.
            // For other orientations, we engrave from the front.
            if (orientation === 'vertical-lr') {
                endDepth = backgroundDepth - engraveDepth;
            } else {
                endDepth = backgroundDepth;
            }
        }

        const startDepth = (orientation !== 'vertical-lr' && isTextPixel) ? engraveDepth : 0;
        
        for (let pz = startDepth; pz < endDepth; pz++) {
          addVoxelByOrientation(px, textHeight - 1 - py, pz);
        }
      }
    }
  }

  // Adjust final model dimensions based on orientation for the schematic info
  if (orientation === 'vertical-lr') {
    const originalHeight = modelHeight;
    modelHeight = modelDepth; // New height is the depth
    modelDepth = originalHeight; // New depth is the text height
  }
 
  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 };
  palette[1] = { r: 200, g: 164, b: 100, a: 255 };

  // Note: vox-saver expects Z-up, so we swap Y and Z in the final object.
  const voxObject = {
      size: { x: modelWidth, y: modelDepth, z: modelHeight },
      xyzi: {
          numVoxels: xyziValues.length,
          values: xyziValues.map(v => ({ x: v.x, y: v.z, z: v.y, i: v.i }))
      },
      rgba: { values: palette }
  };
    
  const buffer: Uint8Array = writeVox(voxObject);
  const voxDataB64 = Buffer.from(buffer).toString('base64');
  
  return {
      schematicData: createSchematicData('VOX Text', {width: modelWidth, height: modelHeight, depth: modelDepth}),
      width: modelWidth,
      height: modelHeight,
      isVox: true,
      voxData: voxDataB64,
  };
}

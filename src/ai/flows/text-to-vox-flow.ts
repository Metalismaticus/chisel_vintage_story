
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
import type { PaletteColor } from '@/lib/schematic-utils';

const TextToVoxInputSchema = z.object({
  pixels: z.array(z.boolean()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: z.enum(['extrude', 'engrave']),
  letterDepth: z.number().int().positive(),
  backgroundDepth: z.number().int().min(0),
  engraveDepth: z.number().int().min(0),
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
    engraveDepth 
  } = TextToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  const addVoxel = (x: number, y: number, z: number) => {
    xyziValues.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), i: 1 });
  };

  let modelWidth = textWidth;
  let modelHeight = textHeight;
  let modelDepth = 0;

  if (mode === 'extrude') {
    modelDepth = letterDepth;
    for (let y = 0; y < textHeight; y++) {
      for (let x = 0; x < textWidth; x++) {
        if (pixels[y * textWidth + x]) {
          for (let z = 0; z < letterDepth; z++) {
            // We flip the y-axis to match the typical 2D canvas coordinates (top-left 0,0)
            addVoxel(x, textHeight - 1 - y, z);
          }
        }
      }
    }
  } else if (mode === 'engrave') {
    modelDepth = backgroundDepth;
    for (let y = 0; y < textHeight; y++) {
      for (let x = 0; x < textWidth; x++) {
        const isTextPixel = pixels[y * textWidth + x];
        const startDepth = isTextPixel ? engraveDepth : 0;
        
        for (let z = startDepth; z < backgroundDepth; z++) {
          addVoxel(x, textHeight - 1 - y, z);
        }
      }
    }
  }

  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 };
  palette[1] = { r: 200, g: 164, b: 100, a: 255 };

  const voxObject = {
      size: { x: modelWidth, y: modelHeight, z: modelDepth },
      xyzi: {
          numVoxels: xyziValues.length,
          values: xyziValues.map(v => ({ x: v.x, y: v.y, z: v.z, i: v.i }))
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

    
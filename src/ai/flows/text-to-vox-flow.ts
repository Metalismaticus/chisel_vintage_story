
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
  stickerMode: z.boolean(),
});

export type TextToVoxInput = z.infer<typeof TextToVoxInputSchema>;

export interface TextToVoxOutput {
  schematicData: string;
  width: number;
  height: number;
  depth: number;
  isVox: boolean;
  voxData: string; // Base64 encoded string
  voxSize: {x: number, y: number, z: number};
}

function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';
    return `Schematic: ${name} (${width}x${height}${depthInfo})`;
}


export async function generateTextToVoxFlow(input: TextToVoxInput): Promise<TextToVoxOutput> {
  const { 
    pixels: originalPixels, 
    width: textWidth, 
    height: textHeight, 
    mode, 
    letterDepth, 
    backgroundDepth, 
    engraveDepth,
    orientation,
    stickerMode,
  } = TextToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  const addVoxel = (px: number, py: number, pz: number, colorIndex = 1) => {
    xyziValues.push({ x: Math.round(px), y: Math.round(py), z: Math.round(pz), i: colorIndex });
  };
  addVoxel(0,0,0,2); // Add anchor point
  
  let pixels = originalPixels;
  let modelWidth = textWidth;
  let modelHeight = textHeight;

  if (mode === 'engrave') {
      const finalWidth = Math.ceil(textWidth / 16) * 16;
      const finalHeight = Math.ceil(textHeight / 16) * 16;
      
      const paddedPixels = Array(finalWidth * finalHeight).fill(false);
      const xOffset = Math.floor((finalWidth - textWidth) / 2);
      const yOffset = Math.floor((finalHeight - textHeight) / 2);
      
      for(let y = 0; y < textHeight; y++) {
          for(let x = 0; x < textWidth; x++) {
              if (originalPixels[y * textWidth + x]) {
                  paddedPixels[(y + yOffset) * finalWidth + (x + xOffset)] = true;
              }
          }
      }
      pixels = paddedPixels;
      modelWidth = finalWidth;
      modelHeight = finalHeight;
  }

  let modelDepth = 0;
  const STICKER_BLOCK_DEPTH = 16;
  

  const mapCoords = (px: number, py: number, pz: number, zOffset: number): [number, number, number] => {
      if (orientation === 'vertical-lr') { 
          return [px, pz + zOffset, modelHeight - 1 - py]; 
      }
      return [px, modelHeight - 1 - py, pz + zOffset]; 
  };

  if (mode === 'extrude') {
    const zOffset = stickerMode ? STICKER_BLOCK_DEPTH - letterDepth : 0;
    modelDepth = stickerMode ? STICKER_BLOCK_DEPTH : letterDepth;

    for (let py = 0; py < modelHeight; py++) {
      for (let px = 0; px < modelWidth; px++) {
        if (pixels[py * modelWidth + px]) {
          for (let pz = 0; pz < letterDepth; pz++) {
            const [x, y, z] = mapCoords(px, py, pz, zOffset);
            addVoxel(x, y, z);
          }
        }
      }
    }
  } else if (mode === 'engrave') {
    modelDepth = stickerMode ? STICKER_BLOCK_DEPTH : backgroundDepth;
    const zOffset = stickerMode ? STICKER_BLOCK_DEPTH - backgroundDepth : 0;
    
    for (let py = 0; py < modelHeight; py++) {
      for (let px = 0; px < modelWidth; px++) {
        const isTextPixel = pixels[py * modelWidth + px];
        
        // If it's a text pixel, we don't dig as deep
        const startDepth = isTextPixel ? engraveDepth : 0;

        for (let pz = startDepth; pz < backgroundDepth; pz++) {
             const [x, y, z] = mapCoords(px, py, pz, zOffset);
             addVoxel(x, y, z);
        }
      }
    }
  }

  let schematicWidth = modelWidth;
  let schematicHeight = modelHeight;
  let schematicDepth = modelDepth;
  if (orientation === 'vertical-lr') {
    schematicHeight = modelDepth; 
    schematicDepth = modelHeight; 
  }
 
  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 }; // MagicaVoxel palette is 1-indexed
  palette[1] = { r: 200, g: 164, b: 100, a: 255 }; // Main color
  palette[2] = { r: 10, g: 10, b: 10, a: 255 }; // Anchor color

  let voxSize;
  // vox-saver uses {x: width, y: depth, z: height}
  if (orientation === 'vertical-lr') {
    voxSize = { x: modelWidth, y: modelDepth, z: modelHeight };
  } else {
    voxSize = { x: modelWidth, y: modelHeight, z: modelDepth };
  }
  
  const finalXyzi = xyziValues.map(v => {
      if (orientation === 'vertical-lr') {
          return { x: v.x, y: v.z, z: v.y, i: v.i };
      }
      return { x: v.x, y: v.z, z: v.y, i: v.i };
  });

  const voxObject = {
      size: voxSize,
      xyzi: {
          numVoxels: finalXyzi.length,
          values: finalXyzi,
      },
      rgba: { values: palette }
  };
    
  const buffer: Uint8Array = writeVox(voxObject);
  const voxDataB64 = Buffer.from(buffer).toString('base64');
  
  return {
      schematicData: createSchematicData('VOX Text', {width: schematicWidth, height: schematicHeight, depth: schematicDepth}),
      width: schematicWidth,
      height: schematicHeight,
      depth: schematicDepth,
      isVox: true,
      voxData: voxDataB64,
      voxSize: voxSize,
  };
}


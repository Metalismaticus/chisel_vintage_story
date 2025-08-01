
'use server';
/**
 * @fileOverview A server action for generating .vox models from pixel art (a boolean pixel array).
 *
 * - generatePixelArtToVoxFlow - A function that handles the pixel art to .vox generation process.
 * - PixelArtToVoxInput - The input type for the flow.
 * - PixelArtToVoxOutput - The return type for the flow.
 */

import { z } from 'zod';
const writeVox = require('vox-saver');
import type { PaletteColor } from '@/lib/schematic-utils';

const PixelArtToVoxInputSchema = z.object({
  pixels: z.array(z.boolean()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mode: z.enum(['extrude', 'engrave']),
  extrudeDepth: z.number().int().positive(),
  engraveBackgroundDepth: z.number().int().min(0),
  engraveDepth: z.number().int().min(0),
  stickerMode: z.boolean(),
});

export type PixelArtToVoxInput = z.infer<typeof PixelArtToVoxInputSchema>;

export interface PixelArtToVoxOutput {
  schematicData: string;
  width: number;
  height: number;
  depth: number;
  isVox: boolean;
  voxData: string; // Base64 encoded string
}

function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';
    return `Schematic: ${name} (${width}x${height}${depthInfo})`;
}


export async function generatePixelArtToVoxFlow(input: PixelArtToVoxInput): Promise<PixelArtToVoxOutput> {
  const { 
    pixels, 
    width: imageWidth, 
    height: imageHeight, 
    mode, 
    extrudeDepth, 
    engraveBackgroundDepth, 
    engraveDepth,
    stickerMode,
  } = PixelArtToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  // Helper to add a voxel, consistently handling Y-up to Z-up conversion for vox-saver
  // Our internal logic is X-Right, Y-Up, Z-Forward
  const addVoxel = (px: number, py: number, pz: number, colorIndex = 1) => {
    xyziValues.push({ x: Math.round(px), y: Math.round(py), z: Math.round(pz), i: colorIndex });
  };
  addVoxel(0,0,0,2); // Add anchor point
  
  let modelWidth = imageWidth;
  let modelHeight = imageHeight;
  let modelDepth = 0;

  const STICKER_BLOCK_DEPTH = 16;
  const zOffset = stickerMode ? STICKER_BLOCK_DEPTH - (mode === 'extrude' ? extrudeDepth : engraveBackgroundDepth) : 0;

  if (mode === 'extrude') {
    modelDepth = stickerMode ? STICKER_BLOCK_DEPTH : extrudeDepth;
    for (let py = 0; py < imageHeight; py++) {
      for (let px = 0; px < imageWidth; px++) {
        if (pixels[py * imageWidth + px]) {
          for (let pz = 0; pz < extrudeDepth; pz++) {
            const finalPz = pz + zOffset;
            addVoxel(px, imageHeight - 1 - py, finalPz);
          }
        }
      }
    }
  } else if (mode === 'engrave') {
    modelDepth = stickerMode ? STICKER_BLOCK_DEPTH : engraveBackgroundDepth;
    
    for (let py = 0; py < imageHeight; py++) {
      for (let px = 0; px < imageWidth; px++) {
        const isPixelSet = pixels[py * imageWidth + px];
        
        // If it's a pixel from the drawing, we don't dig as deep
        const endDepth = isPixelSet ? engraveBackgroundDepth - engraveDepth : engraveBackgroundDepth;

        for (let pz = 0; pz < endDepth; pz++) {
            const finalPz = pz + zOffset;
            addVoxel(px, imageHeight - 1 - py, finalPz);
        }
      }
    }
  }

  const finalWidth = modelWidth;
  const finalHeight = modelHeight;
  const finalDepth = modelDepth;
 
  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 };
  palette[1] = { r: 200, g: 164, b: 100, a: 255 }; // Main color
  palette[2] = { r: 10, g: 10, b: 10, a: 255 }; // Anchor color

  // Determine the final size for the .vox file, swapping Y and Z for Z-up format
  const voxSize = { x: modelWidth, y: modelDepth, z: modelHeight };

  const voxObject = {
      size: voxSize,
      xyzi: {
          numVoxels: xyziValues.length,
          // Note: vox-saver expects Z-up, so we swap Y and Z from our internal coord system in the final object.
          values: xyziValues.map(v => ({ x: v.x, y: v.z, z: v.y, i: v.i }))
      },
      rgba: { values: palette }
  };
    
  const buffer: Uint8Array = writeVox(voxObject);
  const voxDataB64 = Buffer.from(buffer).toString('base64');
  
  return {
      schematicData: createSchematicData('VOX PixelArt', {width: finalWidth, height: finalHeight, depth: finalDepth}),
      width: finalWidth,
      height: finalHeight,
      depth: finalDepth,
      isVox: true,
      voxData: voxDataB64,
  };
}

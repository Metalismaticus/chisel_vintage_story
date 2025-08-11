
'use server';
/**
 * @fileOverview A server action for generating .vox models of signs with icons and text.
 * 
 * - generateSignToVoxFlow - A function that handles the sign generation process.
 * - SignToVoxInput - The input type for the flow.
 * - SignToVoxOutput - The return type for the flow.
 */

import { z } from 'zod';
const writeVox = require('vox-saver');
import type { PaletteColor } from '@/lib/schematic-utils';

const PixelDataSchema = z.object({
    pixels: z.array(z.boolean()),
    width: z.number().int(),
    height: z.number().int(),
    offsetY: z.number().int().optional(),
});

const SignToVoxInputSchema = z.object({
    width: z.number().int().min(16),
    height: z.number().int().min(16),
    frameWidth: z.number().int().min(1),
    icon: PixelDataSchema,
    text: PixelDataSchema,
});

export type SignToVoxInput = z.infer<typeof SignToVoxInputSchema>;

export interface SignToVoxOutput {
    schematicData: string;
    width: number;
    height: number;
    depth: number;
    isVox: boolean;
    voxData: string; // Base64 encoded string
    voxSize: {x: number, y: number, z: number};
    totalVoxels: number;
}

function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';
    return `Schematic: ${name} (${width}x${height}${depthInfo})`;
}


export async function generateSignToVoxFlow(input: SignToVoxInput): Promise<SignToVoxOutput> {
  const { 
    width: signWidth,
    height: signHeight,
    frameWidth,
    icon,
    text
  } = SignToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  const addVoxel = (px: number, py: number, pz: number, colorIndex = 1) => {
    xyziValues.push({ x: Math.round(px), y: Math.round(py), z: Math.round(pz), i: colorIndex });
  };
  addVoxel(0,0,0,2); // Anchor point

  // 1. Generate Frame
  const cornerRadius = frameWidth * 2;
  for(let y = 0; y < signHeight; y++) {
    for (let x = 0; x < signWidth; x++) {
        let isFrame = false;
        // Top/Bottom border
        if (y < frameWidth || y >= signHeight - frameWidth) isFrame = true;
        // Left/Right border
        if (x < frameWidth || x >= signWidth - frameWidth) isFrame = true;

        // Carve out rounded corners
        // Top-left
        if (x < cornerRadius && y < cornerRadius) {
            const dx = cornerRadius - x;
            const dy = cornerRadius - y;
            if (dx*dx + dy*dy > cornerRadius*cornerRadius) isFrame = false;
        }
        // Top-right
        if (x >= signWidth - cornerRadius && y < cornerRadius) {
            const dx = x - (signWidth - cornerRadius);
            const dy = cornerRadius - y;
            if (dx*dx + dy*dy > cornerRadius*cornerRadius) isFrame = false;
        }
        // Bottom-left
         if (x < cornerRadius && y >= signHeight - cornerRadius) {
            const dx = cornerRadius - x;
            const dy = y - (signHeight - cornerRadius);
            if (dx*dx + dy*dy > cornerRadius*cornerRadius) isFrame = false;
        }
        // Bottom-right
        if (x >= signWidth - cornerRadius && y >= signHeight - cornerRadius) {
            const dx = x - (signWidth - cornerRadius);
            const dy = y - (signHeight - cornerRadius);
            if (dx*dx + dy*dy > cornerRadius*cornerRadius) isFrame = false;
        }

        if(isFrame) addVoxel(x, signHeight - 1 - y, 0);
    }
  }
  
  const contentHeight = signHeight - frameWidth * 2;
  const contentCenterY = Math.floor(signHeight / 2);
  
  // 2. Place Icon
  const iconXOffset = Math.floor((signWidth - icon.width) / 2);
  const iconYOffset = contentCenterY + Math.floor(contentHeight * 0.25) - Math.floor(icon.height / 2) + (icon.offsetY || 0);

  for (let y = 0; y < icon.height; y++) {
      for (let x = 0; x < icon.width; x++) {
          if (icon.pixels[y * icon.width + x]) {
              addVoxel(x + iconXOffset, signHeight - 1 - (y + iconYOffset), 0);
          }
      }
  }

  // 3. Place Text
  const textXOffset = Math.floor((signWidth - text.width) / 2);
  const textYOffset = contentCenterY - Math.floor(contentHeight * 0.25) - Math.floor(text.height / 2) + (text.offsetY || 0);

  for (let y = 0; y < text.height; y++) {
      for (let x = 0; x < text.width; x++) {
          if (text.pixels[y * text.width + x]) {
              addVoxel(x + textXOffset, signHeight - 1 - (y + textYOffset), 0);
          }
      }
  }

  const modelWidth = signWidth;
  const modelHeight = signHeight;
  const modelDepth = 1;
 
  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 };
  palette[1] = { r: 10, g: 10, b: 10, a: 255 }; // Main color
  palette[2] = { r: 200, g: 164, b: 100, a: 255 }; // Anchor color

  const voxSize = { x: modelWidth, y: modelDepth, z: modelHeight };

  const voxObject = {
      size: voxSize,
      xyzi: {
          numVoxels: xyziValues.length,
          values: xyziValues.map(v => ({ x: v.x, y: v.z, z: v.y, i: v.i }))
      },
      rgba: { values: palette }
  };
    
  const buffer: Uint8Array = writeVox(voxObject);
  const voxDataB64 = Buffer.from(buffer).toString('base64');
  
  return {
      schematicData: createSchematicData('VOX Sign', {width: modelWidth, height: modelHeight, depth: modelDepth}),
      width: modelWidth,
      height: modelHeight,
      depth: modelDepth,
      isVox: true,
      voxData: voxDataB64,
      voxSize: voxSize,
      totalVoxels: xyziValues.length - 1,
  };
}

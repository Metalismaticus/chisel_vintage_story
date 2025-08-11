
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
import type { PaletteColor, FontStyle } from '@/lib/schematic-utils';
import { rasterizeText } from '@/lib/schematic-utils';

const SignToVoxInputSchema = z.object({
    width: z.number().int().min(16),
    height: z.number().int().min(16),
    frameWidth: z.number().int().min(1),
    iconDataUrl: z.string(),
    text: z.string(),
    font: z.enum(['monospace', 'serif', 'sans-serif', 'custom']),
    fontSize: z.number().int().min(1),
    fontUrl: z.string().optional().nullable(),
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

// Helper to create pixel data from an image data URL
async function imageToPixels(dataUrl: string, targetWidth: number): Promise<{pixels: boolean[], width: number, height: number}> {
    // This is a simplified version. For a real implementation, you'd use a library like 'canvas' on node
    // or run this part in a browser/worker context. For now, we'll simulate it.
    // In a browser environment, you would do:
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
    });

    const aspectRatio = img.height / img.width;
    const width = targetWidth;
    const height = Math.round(width * aspectRatio);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas context for icon');
    
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    const pixels: boolean[] = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
        // Simple thresholding for B&W
        const brightness = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
        pixels.push(brightness < 128);
    }

    return { pixels, width, height };
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
    iconDataUrl,
    text,
    font,
    fontSize,
    fontUrl
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

        if(isFrame) addVoxel(x, y, 0);
    }
  }
  
  const contentWidth = signWidth - frameWidth * 4;
  const contentHeight = signHeight - frameWidth * 2;
  
  // 2. Generate and place Icon
  const iconTargetWidth = Math.floor(contentWidth * 0.5);
  const { pixels: iconPixels, width: iconWidth, height: iconHeight } = await imageToPixels(iconDataUrl, iconTargetWidth);

  const iconXOffset = Math.floor((signWidth - iconWidth) / 2);
  const iconYOffset = signHeight - frameWidth - Math.floor(contentHeight * 0.1) - iconHeight;

  for (let y = 0; y < iconHeight; y++) {
      for (let x = 0; x < iconWidth; x++) {
          if (iconPixels[y * iconWidth + x]) {
              addVoxel(x + iconXOffset, y + iconYOffset, 0);
          }
      }
  }

  // 3. Generate and place Text
  const { pixels: textPixels, width: textWidth, height: textHeight } = await rasterizeText({ text, font, fontSize, fontUrl });

  const textXOffset = Math.floor((signWidth - textWidth) / 2);
  const textYOffset = iconYOffset - Math.floor(contentHeight * 0.1) - textHeight;

  for (let y = 0; y < textHeight; y++) {
      for (let x = 0; x < textWidth; x++) {
          if (textPixels[y * textWidth + x]) {
              addVoxel(x + textXOffset, y + textYOffset, 0);
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


'use server';
/**
 * @fileOverview A server action for generating .vox models from QR code data.
 *
 * - generateQrToVoxFlow - A function that handles the QR code to .vox generation process.
 * - QrToVoxInput - The input type for the flow.
 * - QrToVoxOutput - The return type for the flow.
 */

import { z } from 'zod';
const writeVox = require('vox-saver');
import type { PaletteColor } from '@/lib/schematic-utils';

const QrToVoxInputSchema = z.object({
  pixels: z.array(z.boolean()),
  size: z.number().int().positive(),
  depth: z.number().int().positive(),
});

export type QrToVoxInput = z.infer<typeof QrToVoxInputSchema>;

export interface QrToVoxOutput {
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


export async function generateQrToVoxFlow(input: QrToVoxInput): Promise<QrToVoxOutput> {
  const { 
    pixels, 
    size,
    depth,
  } = QrToVoxInputSchema.parse(input);

  let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
  
  const modelWidth = size;
  const modelHeight = size;
  const modelDepth = depth;

  for (let py = 0; py < modelHeight; py++) {
    for (let px = 0; px < modelWidth; px++) {
      // Create the QR code block
      if (pixels[py * modelWidth + px]) {
        for (let pz = 0; pz < modelDepth; pz++) {
            // We flip the y-axis to match the typical 2D canvas coordinates (top-left 0,0)
            xyziValues.push({ x: px, y: modelHeight - 1 - py, z: pz, i: 1 });
        }
      }
    }
  }
 
  const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
  palette[0] = { r: 0, g: 0, b: 0, a: 0 };
  // We make the QR code black for the classic look
  palette[1] = { r: 10, g: 10, b: 10, a: 255 };

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
      schematicData: createSchematicData('QR Code', {width: modelWidth, height: modelHeight, depth: modelDepth}),
      width: modelWidth,
      height: modelHeight,
      isVox: true,
      voxData: voxDataB64,
  };
}

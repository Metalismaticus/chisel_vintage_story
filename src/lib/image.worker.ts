
/// <reference lib="webworker" />

import { imageToSchematic, type ConversionMode } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number; outputWidth: number; mode: ConversionMode }>) => {
  try {
    const { file, threshold, outputWidth, mode } = event.data;
    
    const imageBitmap = await createImageBitmap(file);
    
    const aspectRatio = imageBitmap.height / imageBitmap.width;
    const scaledWidth = outputWidth;
    const scaledHeight = Math.round(outputWidth * aspectRatio);

    if (scaledWidth <= 0 || scaledHeight <= 0) {
      throw new Error('Calculated dimensions are invalid. Please choose a larger width.');
    }

    const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error('Failed to get OffscreenCanvas context for scaling.');
    }
    
    // Draw the original bitmap to the smaller canvas, which implicitly scales it.
    ctx.drawImage(imageBitmap, 0, 0, scaledWidth, scaledHeight);
    
    // Now generate the schematic and pixel data from the scaled canvas
    const result = await imageToSchematic(ctx, threshold, mode);

    imageBitmap.close();

    self.postMessage(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    self.postMessage({ error: errorMessage });
  }
};

// This export is needed to satisfy the module system.
export {};

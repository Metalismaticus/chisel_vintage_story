/// <reference lib="webworker" />

import { imageToSchematic, type SchematicOutput } from './schematic-utils';

const MAX_PREVIEW_DIMENSION = 128;

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number }>) => {
  console.log('[Worker] Received message:', event.data);
  try {
    const { file, threshold } = event.data;
    
    console.log('[Worker] Attempting to create ImageBitmap...');
    const imageBitmap = await createImageBitmap(file);
    console.log(`[Worker] ImageBitmap created successfully. Original Dimensions: ${imageBitmap.width}x${imageBitmap.height}`);

    // Generate the full-size schematic data first, as this is just string manipulation
    // and doesn't require canvas processing.
    const fullSchematicData = imageToSchematic(imageBitmap, threshold, false) as string;

    // Now, create the pixel preview, scaling down if necessary.
    let previewWidth = imageBitmap.width;
    let previewHeight = imageBitmap.height;

    if (previewWidth > MAX_PREVIEW_DIMENSION || previewHeight > MAX_PREVIEW_DIMENSION) {
        if (previewWidth > previewHeight) {
            previewHeight = Math.round((MAX_PREVIEW_DIMENSION / previewWidth) * previewHeight);
            previewWidth = MAX_PREVIEW_DIMENSION;
        } else {
            previewWidth = Math.round((MAX_PREVIEW_DIMENSION / previewHeight) * previewWidth);
            previewHeight = MAX_PREVIEW_DIMENSION;
        }
        console.log(`[Worker] Image scaled down for preview to: ${previewWidth}x${previewHeight}`);
    }

    const canvas = new OffscreenCanvas(previewWidth, previewHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get OffscreenCanvas context for preview.');
    }
    
    // Draw the original bitmap to the smaller canvas, which implicitly scales it.
    ctx.drawImage(imageBitmap, 0, 0, previewWidth, previewHeight);
    
    const imageData = ctx.getImageData(0, 0, previewWidth, previewHeight);
    const pixels: boolean[] = [];

    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
        pixels.push(grayscale < threshold);
    }
    
    imageBitmap.close();

    const result: SchematicOutput = {
        schematicData: fullSchematicData,
        width: previewWidth, // Use preview dimensions for grid
        height: previewHeight,
        pixels: pixels, // Use scaled-down pixel array
        originalWidth: imageBitmap.width, // Keep original dimensions for info
        originalHeight: imageBitmap.height,
    };
    
    console.log('[Worker] Schematic generation complete. Posting result back.');
    self.postMessage(result);
    
  } catch (error) {
    console.error('[Worker] Error during processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    
    console.log(`[Worker] Posting error message back: "${errorMessage}"`);
    self.postMessage({ error: errorMessage });
  }
};

// This export is needed to satisfy the module system.
export {};

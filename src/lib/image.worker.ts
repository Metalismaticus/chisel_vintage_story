/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number }>) => {
  console.log('[Worker] Received message:', event.data);
  try {
    const { file, threshold } = event.data;
    
    console.log('[Worker] Attempting to create ImageBitmap...');
    const imageBitmap = await createImageBitmap(file);
    console.log(`[Worker] ImageBitmap created successfully. Dimensions: ${imageBitmap.width}x${imageBitmap.height}`);
    
    const result = await imageToSchematic(imageBitmap, threshold);
    console.log('[Worker] Schematic generation complete. Posting result back.');
    
    self.postMessage(result);
  } catch (error) {
    console.error('[Worker] Error during processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    
    console.log(`[Worker] Posting error message back: "${errorMessage}"`);
    // If an error occurs, post an error object back to the main thread.
    self.postMessage({ error: errorMessage });
  }
};

// This export is needed to satisfy the module system.
export {};

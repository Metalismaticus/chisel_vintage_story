
/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ imageBitmap: ImageBitmap; threshold: number }>) => {
  try {
    const { imageBitmap, threshold } = event.data;
    // Pass the ImageBitmap directly to the processing function.
    const result = await imageToSchematic(imageBitmap, threshold);
    self.postMessage(result);
  } catch (error) {
    // Ensure a proper error message is sent back
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    self.postMessage({ error: errorMessage });
  }
};

export {};

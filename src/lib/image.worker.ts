/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number }>) => {
  try {
    const { file, threshold } = event.data;
    // Create ImageBitmap from the file *inside the worker*.
    // This is the most important step to keep the main thread non-blocking.
    const imageBitmap = await createImageBitmap(file);
    const result = await imageToSchematic(imageBitmap, threshold);
    self.postMessage(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    // If an error occurs, post an error object back to the main thread.
    self.postMessage({ error: errorMessage });
  }
};

// This export is needed to satisfy the module system.
export {};

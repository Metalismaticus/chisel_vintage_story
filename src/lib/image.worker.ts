
/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ file: File; threshold: number }>) => {
  try {
    const { file, threshold } = event.data;
    // Heavy operation (createImageBitmap) is now safely inside the worker
    const imageBitmap = await createImageBitmap(file);
    const result = await imageToSchematic(imageBitmap, threshold);
    self.postMessage(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    self.postMessage({ error: errorMessage });
  }
};

export {};

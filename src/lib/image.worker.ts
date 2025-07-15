/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ dataUri: string; threshold: number }>) => {
  try {
    const { dataUri, threshold } = event.data;
    const result = await imageToSchematic(dataUri, threshold);
    self.postMessage(result);
  } catch (error) {
    // Ensure a proper error message is sent back
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the worker.';
    self.postMessage({ error: errorMessage });
  }
};

export {};

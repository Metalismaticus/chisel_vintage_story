/// <reference lib="webworker" />

import { imageToSchematic } from './schematic-utils';

self.onmessage = async (event: MessageEvent<{ dataUri: string; threshold: number }>) => {
  try {
    const { dataUri, threshold } = event.data;
    const result = await imageToSchematic(dataUri, threshold);
    self.postMessage(result);
  } catch (error) {
    // Propagate the error back to the main thread
    if (error instanceof Error) {
        self.postMessage({ error: error.message });
    } else {
        self.postMessage({ error: 'An unknown error occurred in the worker.' });
    }
  }
};

export {};

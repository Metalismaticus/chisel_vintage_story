import { genkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';

// This file is not used by the core schematic generation logic,
// but is kept for potential future AI-powered features.
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

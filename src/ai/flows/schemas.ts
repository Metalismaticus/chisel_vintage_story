// src/ai/flows/schemas.ts
import {z} from 'genkit';

/**
 * @fileOverview Shared schemas and types for schematic generation flows.
 */

// Shared Output Schema
export const SchematicOutputSchema = z.object({
  schematicData: z.string().describe('The generated schematic data for Vintage Story in a single string.'),
  width: z.number().describe('The width of the generated pixel art in pixels.'),
  height: z.number().describe('The height of the generated pixel art in pixels.'),
  pixels: z.array(z.boolean()).describe('A flattened array of booleans representing the pixel data. True for a filled pixel, false for an empty one.'),
});
export type SchematicOutput = z.infer<typeof SchematicOutputSchema>;


// Image to Schematic
export const ImageToSchematicInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to convert to a schematic, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ImageToSchematicInput = z.infer<typeof ImageToSchematicInputSchema>;


// Text to Schematic
export const TextToSchematicInputSchema = z.object({
  text: z.string().describe('The text to convert to a schematic.'),
  font: z.string().describe('The font family to use for the text.'),
  fontSize: z.number().describe('The font size in pixels.'),
});
export type TextToSchematicInput = z.infer<typeof TextToSchematicInputSchema>;


// Shape to Schematic
export const ShapeToSchematicInputSchema = z.object({
  shape: z.enum(['circle', 'square', 'triangle']).describe('The shape to generate.'),
  dimensions: z.object({
    radius: z.number().optional().describe('The radius of the circle in pixels.'),
    width: z.number().optional().describe('The width of the square in pixels.'),
    side: z.number().optional().describe('The side length of the equilateral triangle in pixels.'),
  }).describe('The dimensions of the shape.'),
});
export type ShapeToSchematicInput = z.infer<typeof ShapeToSchematicInputSchema>;

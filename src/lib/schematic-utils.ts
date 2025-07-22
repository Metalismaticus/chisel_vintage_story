
import type { ConversionMode } from './schematic-utils';
const writeVox = require('vox-saver');


export interface PaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface SchematicOutput {
  schematicData: string;
  width: number;
  height: number;
  pixels: (boolean | number)[];
  isVox?: boolean;
  voxData?: Uint8Array;
  palette?: PaletteColor[];
  originalWidth?: number;
  originalHeight?: number;
}

export type FontStyle = 'monospace' | 'serif' | 'sans-serif' | 'custom';
export type Shape = 'circle' | 'triangle' | 'rhombus' | 'hexagon';

type HemispherePart = `hemisphere-${'top' | 'bottom' | 'vertical'}`;
type DiskOrientation = 'horizontal' | 'vertical';


export type VoxShape = 
    | { type: 'cuboid', width: number, height: number, depth: number }
    | { type: 'sphere', radius: number, part?: 'full' | HemispherePart }
    | { type: 'pyramid', base: number, height: number }
    | { type: 'cone', radius: number, height: number }
    | { type: 'column', radius: number, height: number }
    | { type: 'arch', width: number, height: number, depth: number }
    | { type: 'disk', radius: number, height: number, part?: 'full' | 'half', orientation: DiskOrientation };


// A simple helper to generate schematic data string
function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';

    const xChunks = Math.ceil(width / 16);
    const yChunks = Math.ceil(height / 16);
    const zChunks = depth ? Math.ceil(depth / 16) : 1;
    const totalChunks = xChunks * yChunks * zChunks;

    return `Schematic: ${name} (${width}x${height}${depthInfo}). Total Blocks: ${totalChunks}`;
}

interface TextToSchematicParams {
  text: string;
  font: FontStyle;
  fontSize: number;
  fontUrl?: string;
  outline?: boolean;
  outlineGap?: number;
}

/**
 * Converts text to a pixel-based schematic.
 * This function uses the browser's Canvas API to rasterize text.
 */
export async function textToSchematic({
  text,
  font,
  fontSize,
  fontUrl,
  outline = false,
  outlineGap = 1,
}: TextToSchematicParams): Promise<SchematicOutput> {
    if (typeof document === 'undefined') {
        throw new Error('textToSchematic can only be run in a browser environment.');
    }

    let loadedFontFamily = font as string;
    if (font === 'monospace') loadedFontFamily = '"Roboto Mono", monospace';
    if (font === 'serif') loadedFontFamily = '"Roboto Slab", serif';
    if (font === 'sans-serif') loadedFontFamily = '"Roboto Condensed", sans-serif';


    let fontFace: FontFace | undefined;
    if (fontUrl && font === 'custom') {
      fontFace = new FontFace('custom-font', `url(${fontUrl})`);
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
        loadedFontFamily = 'custom-font';
      } catch (e) {
        console.error('Font loading failed:', e);
        loadedFontFamily = '"Roboto Condensed", sans-serif';
      }
    }

    // Step 1: Measure text to determine required canvas size
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    tempCtx.font = `${fontSize}px ${loadedFontFamily}`;
    const metrics = tempCtx.measureText(text);
    
    const textWidth = Math.ceil(metrics.width) || 1;
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
    const textHeight = Math.ceil(ascent + descent) || 1;

    if (textWidth <= 0 || textHeight <= 0) {
      if (fontFace && document.fonts.has(fontFace)) document.fonts.delete(fontFace);
      return {
        schematicData: createSchematicData(`Empty Text`, {width: 0, height: 0}),
        width: 0,
        height: 0,
        pixels: [],
      };
    }
    
    // Calculate padding needed for the outline and gap
    const PADDING = outline ? (outlineGap + 2) : 1;
    const contentWidth = textWidth + PADDING * 2;
    const contentHeight = textHeight + PADDING * 2;
    
    // Create a canvas large enough for the content
    const contentCanvas = document.createElement('canvas');
    contentCanvas.width = contentWidth;
    contentCanvas.height = contentHeight;
    const contentCtx = contentCanvas.getContext('2d', { willReadFrequently: true })!;

    // Draw the text in the middle of this content canvas
    contentCtx.font = `${fontSize}px ${loadedFontFamily}`;
    contentCtx.fillStyle = '#FFFFFF';
    contentCtx.textBaseline = 'top';
    contentCtx.fillText(text, PADDING, PADDING);
    
    const imageData = contentCtx.getImageData(0, 0, contentWidth, contentHeight);
    const rawPixels = Array(contentWidth * contentHeight).fill(false);
    
    // Get the initial text pixels
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 128) {
            rawPixels[i / 4] = true;
        }
    }
    
    let finalContentPixels: boolean[] = rawPixels;

    if (outline) {
        const textPixels = [...rawPixels]; // Keep a copy of original text pixels
        const outlinePixels = Array(contentWidth * contentHeight).fill(false);
        const distance = outlineGap + 1; // The exact distance for the outline

        for (let y = 0; y < contentHeight; y++) {
            for (let x = 0; x < contentWidth; x++) {
                if (!textPixels[y * contentWidth + x]) { // Check only empty pixels
                    let isOutlinePixel = false;
                    // Check in a square around the pixel
                    for (let dy = -distance; dy <= distance; dy++) {
                        for (let dx = -distance; dx <= distance; dx++) {
                            // We want pixels at the exact distance, forming a hollow square shape
                            if (Math.abs(dx) === distance || Math.abs(dy) === distance) {
                                const checkX = x + dx;
                                const checkY = y + dy;

                                if (checkX >= 0 && checkX < contentWidth && checkY >= 0 && checkY < contentHeight) {
                                    if (textPixels[checkY * contentWidth + checkX]) {
                                        isOutlinePixel = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (isOutlinePixel) break;
                    }
                    if (isOutlinePixel) {
                        outlinePixels[y * contentWidth + x] = true;
                    }
                }
            }
        }
        
        // Combine original text and the new outline
        finalContentPixels = Array(contentWidth * contentHeight).fill(false);
        for(let i = 0; i < finalContentPixels.length; i++) {
            finalContentPixels[i] = textPixels[i] || outlinePixels[i];
        }
    }


    // Step 2: Create the final canvas, aligned to 16x16 chunks
    const finalWidth = Math.ceil(contentWidth / 16) * 16;
    const finalHeight = Math.ceil(contentHeight / 16) * 16;
    const finalPixels = Array(finalWidth * finalHeight).fill(false);
    
    // Step 3: Place the content from the temp canvas onto the final canvas
    const xOffset = Math.floor((finalWidth - contentWidth) / 2);
    const yOffset = Math.floor((finalHeight - contentHeight) / 2);
    
    for(let y = 0; y < contentHeight; y++) {
        for (let x = 0; x < contentWidth; x++) {
            if (finalContentPixels[y * contentWidth + x]) {
                finalPixels[(y + yOffset) * finalWidth + (x + xOffset)] = true;
            }
        }
    }

    if (fontFace && document.fonts.has(fontFace)) {
        document.fonts.delete(fontFace);
    }

    return {
        schematicData: createSchematicData(`Text: "${text}"`, {width: finalWidth, height: finalHeight}),
        width: finalWidth,
        height: finalHeight,
        pixels: finalPixels,
        originalWidth: contentWidth,
        originalHeight: contentHeight
    };
}


/**
 * Generates a pixel-based schematic for a given shape.
 */
export function shapeToSchematic(shape: 
    { type: 'circle', radius: number } | 
    { type: 'triangle', base: number, height: number, apexOffset: number } |
    { type: 'rhombus', width: number, height: number } |
    { type: 'hexagon', radius: number }
): SchematicOutput {
    let rawPixels: boolean[] = [];
    let contentWidth: number, contentHeight: number;

    switch (shape.type) {
        case 'circle': {
            contentWidth = contentHeight = shape.radius * 2;
            if (shape.radius <= 0) {
                rawPixels = [];
                break;
            };

            const centerX = contentWidth / 2.0;
            const centerY = contentHeight / 2.0;
            const r = shape.radius;

            for (let y = 0; y < contentHeight; y++) {
                for (let x = 0; x < contentWidth; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const dx = px - centerX;
                    const dy = py - centerY;
                    rawPixels.push(dx * dx + dy * dy < r * r);
                }
            }
            break;
        }

        case 'triangle': {
            contentWidth = shape.base;
            contentHeight = shape.height;
            rawPixels = Array(contentWidth * contentHeight).fill(false);
            
            if (contentHeight > 0 && contentWidth > 0) {
                const geometricCenterX = (contentWidth / 2.0) + shape.apexOffset;

                for (let y = 0; y < contentHeight; y++) {
                    const progress = contentHeight > 1 ? y / (contentHeight - 1) : 1;
                    const currentWidth = progress * contentWidth;
                    
                    const startX = geometricCenterX - currentWidth / 2.0;
                    const endX = geometricCenterX + currentWidth / 2.0;

                    for (let x = 0; x < contentWidth; x++) {
                        const px = x + 0.5;
                        if (px >= startX && px <= endX) {
                            rawPixels[y * contentWidth + x] = true;
                        }
                    }
                }
            }
            break;
        }
            
        case 'rhombus': {
            contentWidth = shape.width;
            contentHeight = shape.height;
            if (contentWidth <= 0 || contentHeight <= 0) {
                rawPixels = [];
                break;
            };

            const centerX = contentWidth / 2.0;
            const centerY = contentHeight / 2.0;

            for (let y = 0; y < contentHeight; y++) {
                for (let x = 0; x < contentWidth; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const dx = Math.abs(px - centerX);
                    const dy = Math.abs(py - centerY);
                    rawPixels.push((dx / (contentWidth / 2.0)) + (dy / (contentHeight / 2.0)) <= 1);
                }
            }
            break;
        }

        case 'hexagon': {
            const r = shape.radius;
            if (r <= 0) {
                contentWidth = 0;
                contentHeight = 0;
                rawPixels = [];
                break;
            }
            // Pointy-topped hexagon
            contentWidth = Math.round(Math.sqrt(3) * r);
            contentHeight = r * 2;
            rawPixels = Array(contentWidth * contentHeight).fill(false);
            const centerX = contentWidth / 2.0;
            const centerY = contentHeight / 2.0;
            
            for (let y = 0; y < contentHeight; y++) {
                for (let x = 0; x < contentWidth; x++) {
                    const px = x + 0.5 - centerX; // Coords relative to center
                    const py = y + 0.5 - centerY;
                    const q2x = Math.abs(px);
                    const q2y = Math.abs(py);
                    if (q2x <= (Math.sqrt(3) * r) / 2 && q2y <= r) {
                        if ((Math.sqrt(3) * q2y) + q2x <= Math.sqrt(3) * r) {
                            rawPixels[y * contentWidth + x] = true;
                        }
                    }
                }
            }
            break;
        }
    }
    
    if (contentWidth === 0 || contentHeight === 0) {
         return {
            schematicData: createSchematicData(`Shape: ${shape.type}`, {width: 0, height: 0}),
            width: 0,
            height: 0,
            pixels: [],
        };
    }

    const finalWidth = Math.ceil(contentWidth / 16) * 16;
    const finalHeight = Math.ceil(contentHeight / 16) * 16;
    const finalPixels = Array(finalWidth * finalHeight).fill(false);
    
    const xOffset = Math.floor((finalWidth - contentWidth) / 2);
    const yOffset = Math.floor((finalHeight - contentHeight) / 2);
    
    for(let y = 0; y < contentHeight; y++) {
        for (let x = 0; x < contentWidth; x++) {
            if (rawPixels[y * contentWidth + x]) {
                finalPixels[(y + yOffset) * finalWidth + (x + xOffset)] = true;
            }
        }
    }

    return {
        schematicData: createSchematicData(`Shape: ${shape.type}`, {width: finalWidth, height: finalHeight}),
        width: finalWidth,
        height: finalHeight,
        pixels: finalPixels,
        originalWidth: contentWidth,
        originalHeight: contentHeight
    };
}


/**
 * Converts an image from a canvas context to a pixel-based schematic.
 * This is designed to work with OffscreenCanvas in a Web Worker.
 */
export async function imageToSchematic(ctx: OffscreenCanvasRenderingContext2D, threshold: number, mode: ConversionMode): Promise<SchematicOutput> {
    const { canvas } = ctx;
    const { width: contentWidth, height: contentHeight } = canvas;
    
    const finalWidth = Math.ceil(contentWidth / 16) * 16;
    const finalHeight = Math.ceil(contentHeight / 16) * 16;

    const xOffset = Math.floor((finalWidth - contentWidth) / 2);
    const yOffset = Math.floor((finalHeight - contentHeight) / 2);
    
    // Create a new canvas with chunk-aligned dimensions
    const finalCanvas = new OffscreenCanvas(finalWidth, finalHeight);
    const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!finalCtx) {
        throw new Error('Failed to get final OffscreenCanvas context.');
    }
    
    // Draw the original scaled image onto the center of the new canvas
    finalCtx.drawImage(canvas, xOffset, yOffset);

    const schematicData = createSchematicData('Imported Image', {width: finalWidth, height: finalHeight});

    try {
        const imageData = finalCtx.getImageData(0, 0, finalWidth, finalHeight);
        const data = imageData.data;
        const pixels: (boolean | number)[] = [];
        
        if (mode === 'bw') {
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                pixels.push(grayscale(r, g, b) < threshold);
            }
            return { schematicData, width: finalWidth, height: finalHeight, pixels, originalWidth: contentWidth, originalHeight: contentHeight };

        } else { // mode === 'color'
            const palette: PaletteColor[] = [];
            const colorMap = new Map<string, number>();
            let colorIndex = 1; // Start with 1, 0 is for transparent

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a < 128) {
                    pixels.push(0); // Transparent
                    continue;
                }
                
                const colorKey = `${r},${g},${b},${a}`;

                if (colorMap.has(colorKey)) {
                    pixels.push(colorMap.get(colorKey)!);
                } else {
                    const newIndex = colorIndex++;
                    colorMap.set(colorKey, newIndex);
                    palette.push({ r, g, b, a });
                    pixels.push(newIndex);
                }
            }
             return { schematicData, width: finalWidth, height: finalHeight, pixels, palette, originalWidth: contentWidth, originalHeight: contentHeight };
        }

    } catch(err) {
        throw new Error(`Failed to process image data: ${err}`);
    }
}


/**
 * Generates a .vox file for a given 3D shape using the vox-saver library.
 */
export function voxToSchematic(shape: VoxShape): SchematicOutput {
    const xyziValues: {x: number, y: number, z: number, i: number}[] = [];
    let width: number, height: number, depth: number;
    let name = `VOX Shape: ${shape.type}`;
    
    // In our app, Y is up. MagicaVoxel and vox-saver expect Z to be up.
    // We will generate with our coordinate system (Y-up) and then create the final voxObject with swapped axes.
    const addVoxel = (x: number, y: number, z: number) => {
        // The color index is 1, which maps to the first color in our palette.
        xyziValues.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), i: 1 });
    };

    switch (shape.type) {
        case 'cuboid':
            width = shape.width;
            height = shape.height;
            depth = shape.depth;
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                        addVoxel(x, y, z);
                    }
                }
            }
            break;

        case 'sphere':
            width = height = depth = shape.radius * 2;
            const { radius, part = 'full' } = shape;
            const center = radius;

            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                  const dx = x - center + 0.5;
                  const dy = y - center + 0.5;
                  const dz = z - center + 0.5;
                  if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                    if (part === 'full') {
                        addVoxel(x, y, z);
                    } else if (part === 'hemisphere-top' && y >= center) {
                        addVoxel(x, y, z);
                    } else if (part === 'hemisphere-bottom' && y < center) {
                        addVoxel(x, y, z);
                    } else if (part === 'hemisphere-vertical' && x < center) {
                        addVoxel(x, y, z);
                    }
                  }
                }
              }
            }
            break;
            
        case 'pyramid':
            width = depth = shape.base;
            height = shape.height;
            for (let y = 0; y < height; y++) {
                const ratio = (height > 1) ? (height - 1 - y) / (height - 1) : 1;
                const levelWidth = Math.max(1, Math.round(width * ratio));
                const offset = Math.floor((width - levelWidth) / 2);
                for (let z = offset; z < offset + levelWidth; z++) {
                    for (let x = offset; x < offset + levelWidth; x++) {
                        addVoxel(x, y, z);
                    }
                }
            }
            break;
        
        case 'column':
            width = depth = shape.radius * 2;
            height = shape.height;
            const colCenter = shape.radius;
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                        const dx = x - colCenter + 0.5;
                        const dz = z - colCenter + 0.5;
                        if (dx * dx + dz * dz <= shape.radius * shape.radius) {
                            addVoxel(x, y, z);
                        }
                    }
                }
            }
            break;
        
        case 'cone':
            width = depth = shape.radius * 2;
            height = shape.height;
            const coneCenter = shape.radius;
            for (let y = 0; y < height; y++) {
                const ratio = (height > 1) ? (height - 1 - y) / (height - 1) : 0;
                const currentRadius = shape.radius * ratio;
                for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                        const dx = x - coneCenter + 0.5;
                        const dz = z - coneCenter + 0.5;
                        if (dx * dx + dz * dz <= currentRadius * currentRadius) {
                            addVoxel(x, y, z);
                        }
                    }
                }
            }
            break;
        
        case 'arch':
            width = shape.width;
            height = shape.height;
            depth = shape.depth;
            const archRadius = width / 2;
            const archCenterX = archRadius;

            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - archCenterX;
                    const dy = y - (height - archRadius);
                    const isInCircle = dx * dx + dy * dy < archRadius * archRadius;
                    if (y < (height - archRadius) || !isInCircle) {
                        addVoxel(x, y, z);
                    }
                }
              }
            }
            break;

        case 'disk':
            const { part: diskPart = 'full', orientation: diskOrientation = 'horizontal' } = shape;
            
            if (diskOrientation === 'vertical') {
                width = shape.height;
                height = shape.radius * 2;
                depth = shape.radius * 2;
            } else { // horizontal
                width = shape.radius * 2;
                height = shape.height;
                depth = shape.radius * 2;
            }
            
            const diskCenterY = diskOrientation === 'vertical' ? shape.radius : shape.height / 2;
            const diskCenterZ = shape.radius;
            const diskCenterX = diskOrientation === 'vertical' ? shape.height/2 : shape.radius;


            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                  for (let x = 0; x < width; x++) {
                      let withinRadius: boolean;
                      
                      if (diskOrientation === 'vertical') {
                          const dx = x - diskCenterX + 0.5;
                          const dy = y - diskCenterY + 0.5;
                          const dz = z - diskCenterZ + 0.5;
                          withinRadius = dy * dy + dz * dz <= shape.radius * shape.radius;
                      } else {
                          const dx = x - diskCenterX + 0.5;
                          const dy = y - diskCenterY + 0.5;
                          const dz = z - diskCenterZ + 0.5;
                          withinRadius = dx * dx + dz * dz <= shape.radius * shape.radius;
                      }

                      if (withinRadius) {
                           if (diskPart === 'full') {
                              addVoxel(x, y, z);
                          } else if (diskPart === 'half') {
                              if (diskOrientation === 'horizontal' && z < diskCenterZ) {
                                  addVoxel(x, y, z);
                              } else if (diskOrientation === 'vertical' && y < diskCenterY) {
                                  addVoxel(x, y, z);
                              }
                          }
                      }
                  }
              }
            }
            break;
    }
    
    // The color is our accent color, #C8A464 -> RGB(200, 164, 100)
    // The library expects a full 256 color palette. We'll fill it with a default color.
    const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
    palette[0] = { r: 0, g: 0, b: 0, a: 0 }; // MagicaVoxel palette is 1-indexed, so 0 is empty
    palette[1] = { r: 200, g: 164, b: 100, a: 255 };
    
    const voxObject = {
        size: { x: width, y: depth, z: height }, // Z is up in .vox format, so we map our depth to Y and height to Z
        xyzi: {
            numVoxels: xyziValues.length,
            // .vox format is Z-up, so we swap our y and z
            values: xyziValues.map(v => ({ x: v.x, y: v.z, z: v.y, i: v.i }))
        },
        rgba: {
            values: palette
        }
    };
    
    const buffer = writeVox(voxObject);

    return {
        schematicData: createSchematicData(name, {width, height, depth}),
        width,
        height,
        pixels: [], // No 2D pixel preview for voxels
        isVox: true,
        voxData: buffer,
    };
}

function grayscale(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

    

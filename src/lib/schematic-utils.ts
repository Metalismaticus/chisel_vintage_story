
import { writeVox } from './vox-writer';

export type ConversionMode = 'bw' | 'color';

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
export type VoxShape = 'cuboid' | 'sphere' | 'pyramid' | 'cylinder' | 'cone';


// A simple helper to generate schematic data string
function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';

    const xChunks = Math.ceil(width / 16);
    const yChunks = Math.ceil(height / 16);
    const zChunks = depth ? Math.ceil(depth / 16) : 1;
    const totalChunks = xChunks * yChunks * zChunks;
    const blockCount = width * height * (depth || 1);

    return `Schematic: ${name} (${width}x${height}${depthInfo}). Total Chunks: ${totalChunks}. Total Blocks: ${blockCount}`;
}

/**
 * Converts text to a pixel-based schematic.
 * This function uses the browser's Canvas API to rasterize text.
 */
export async function textToSchematic(text: string, font: FontStyle, fontSize: number, fontUrl?: string): Promise<SchematicOutput> {
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
        // Fallback to a default font if loading fails
        loadedFontFamily = '"Roboto Condensed", sans-serif';
      }
    }


    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    ctx.font = `${fontSize}px ${loadedFontFamily}`;
    const metrics = ctx.measureText(text);
    
    const width = Math.ceil(metrics.width) || 1;
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
    const height = Math.ceil(ascent + descent) || 1;
    
    if (width === 0 || height === 0) {
      return {
        schematicData: createSchematicData(`Empty Text`, {width: 0, height: 0}),
        width: 0,
        height: 0,
        pixels: [],
      };
    }

    canvas.width = width;
    canvas.height = height;
    
    // Re-apply font settings after resize
    ctx.font = `${fontSize}px ${loadedFontFamily}`;
    ctx.fillStyle = '#F0F0F0';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels: boolean[] = [];

    for (let i = 0; i < imageData.data.length; i += 4) {
        // Check the alpha channel
        const alpha = imageData.data[i + 3];
        pixels.push(alpha > 128); // Pixel is "on" if it's not fully transparent
    }

    if (fontFace && document.fonts.has(fontFace)) {
        document.fonts.delete(fontFace);
    }

    return {
        schematicData: createSchematicData(`Text: "${text}"`, {width, height}),
        width,
        height,
        pixels,
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
    let pixels: boolean[] = [];
    let width: number, height: number;

    switch (shape.type) {
        case 'circle':
            width = height = shape.radius * 2;
            const center = shape.radius;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - center + 0.5;
                    const dy = y - center + 0.5;
                    pixels.push(dx * dx + dy * dy <= shape.radius * shape.radius);
                }
            }
            break;

        case 'triangle': {
            width = shape.base;
            height = shape.height;
            pixels = Array(width * height).fill(false);
            
            const isBaseEven = width % 2 === 0;
            const topWidth = isBaseEven ? 2 : 1;
            const apexXStart = Math.floor((width - topWidth) / 2) + shape.apexOffset;

            const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
                let dx = Math.abs(x2 - x1);
                let dy = -Math.abs(y2 - y1);
                let sx = x1 < x2 ? 1 : -1;
                let sy = y1 < y2 ? 1 : -1;
                let err = dx + dy;

                while (true) {
                    if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) {
                        pixels[y1 * width + x1] = true;
                    }
                    if (x1 === x2 && y1 === y2) break;
                    let e2 = 2 * err;
                    if (e2 >= dy) {
                        err += dy;
                        x1 += sx;
                    }
                    if (e2 <= dx) {
                        err += dx;
                        y1 += sy;
                    }
                }
            };
            
            for (let i = 0; i < topWidth; i++) {
                drawLine(apexXStart + i, 0, 0, height - 1);
                drawLine(apexXStart + i, 0, width - 1, height - 1);
            }

            for (let y = 0; y < height; y++) {
                let startX = -1, endX = -1;
                for (let x = 0; x < width; x++) {
                    if (pixels[y * width + x]) {
                        if (startX === -1) startX = x;
                        endX = x;
                    }
                }
                if (startX !== -1) {
                    for (let x = startX; x <= endX; x++) {
                        pixels[y * width + x] = true;
                    }
                }
            }
            break;
        }
            
        case 'rhombus':
            width = shape.width;
            height = shape.height;
            const centerX = (width - 1) / 2;
            const centerY = (height - 1) / 2;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = Math.abs(x - centerX);
                    const dy = Math.abs(y - centerY);
                    pixels.push((dx / (width / 2)) + (dy / (height / 2)) <= 1);
                }
            }
            break;

        case 'hexagon':
            const r = shape.radius;
            width = r * 2;
            height = Math.ceil(Math.sqrt(3) * r);
            const hexCenterX = r;
            const hexCenterY = height / 2;
            const sideLength = r;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = Math.abs(x - hexCenterX);
                    const dy = Math.abs(y - hexCenterY);
                    pixels.push(dy <= (Math.sqrt(3) / 2) * sideLength && dx <= sideLength - (1 / Math.sqrt(3)) * dy);
                }
            }
            break;
    }

    return {
        schematicData: createSchematicData(`Shape: ${shape.type}`, {width, height}),
        width,
        height,
        pixels,
    };
}

/**
 * Converts an image from a canvas context to a pixel-based schematic.
 * This is designed to work with OffscreenCanvas in a Web Worker.
 */
export async function imageToSchematic(ctx: OffscreenCanvasRenderingContext2D, threshold: number, mode: ConversionMode): Promise<SchematicOutput> {
    const { canvas } = ctx;
    const { width, height } = canvas;
    const schematicData = createSchematicData('Imported Image', {width, height});

    try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels: (boolean | number)[] = [];
        let palette: PaletteColor[] | undefined;

        if (mode === 'bw') {
            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
                pixels.push(grayscale < threshold);
            }
        } else { // mode === 'color'
            // For now, we'll just use a placeholder palette and logic.
            // This can be expanded later to use a full VS color palette and color matching.
            palette = [{ r: 128, g: 128, b: 128, a: 255 }]; // Placeholder gray color
            for (let i = 0; i < imageData.data.length; i += 4) {
                const alpha = imageData.data[i+3];
                if (alpha > 128) {
                    pixels.push(1); // Use color index 1 for all non-transparent pixels
                } else {
                    pixels.push(0); // Use 0 for transparent pixels
                }
            }
        }

        return {
            schematicData,
            width,
            height,
            pixels,
            palette
        };
    } catch(err) {
        throw new Error(`Failed to process image data: ${err}`);
    }
}


/**
 * Generates a .vox file for a given 3D shape.
 */
export function voxToSchematic(shape: 
    { type: 'cuboid', width: number, height: number, depth: number } | 
    { type: 'sphere', radius: number } |
    { type: 'pyramid', base: number, height: number } |
    { type: 'cylinder', radius: number, height: number } |
    { type: 'cone', radius: number, height: number }
): SchematicOutput {
    const voxels: {x: number, y: number, z: number, colorIndex: number}[] = [];
    let width: number, height: number, depth: number;
    let name = `VOX Shape: ${shape.type}`;
    
    // In our app, Y is up. In MagicaVoxel, Z is up. We will perform the coordinate swap
    // right before adding the voxel to the list.
    const addVoxel = (x: number, y: number, z: number) => {
        // The color index is 1, which will map to the first color in our palette.
        voxels.push({ x, y: z, z: y, colorIndex: 1 });
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
            const { radius } = shape;
            const center = radius;

            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                  const dx = x - center + 0.5;
                  const dy = y - center + 0.5;
                  const dz = z - center + 0.5;
                  if (dx * dx + dy * dy + dz * dz <= radius * radius) {
                    addVoxel(x, y, z);
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
        
        case 'cylinder':
            width = depth = shape.radius * 2;
            height = shape.height;
            const cylCenter = shape.radius;
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                        const dx = x - cylCenter + 0.5;
                        const dz = z - cylCenter + 0.5;
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
    }
    
    // The color is our accent color, #C8A464 -> RGB(200, 164, 100)
    const palette = [
      { r: 200, g: 164, b: 100, a: 255 }
    ];
    
    const size = {
        x: width,
        y: depth, // y and z are swapped for MagicaVoxel's coordinate system
        z: height,
    };
    
    const buffer = writeVox({size, voxels, palette});

    return {
        schematicData: createSchematicData(name, {width, height, depth}),
        width,
        height,
        pixels: [], // No 2D pixel preview for voxels
        isVox: true,
        voxData: buffer,
    };
}

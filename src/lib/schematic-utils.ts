

import type { ConversionMode } from './schematic-utils';
const { writeVox } = require('vox-saver');


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
export type VoxShape = 
    | { type: 'cuboid', width: number, height: number, depth: number }
    | { type: 'sphere', radius: number }
    | { type: 'pyramid', base: number, height: number }
    | { type: 'cone', radius: number, height: number }
    | { type: 'column', radius: number, height: number }
    | { type: 'arch', width: number, height: number, depth: number }
    | { type: 'disk', radius: number, height: number };


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

            if (height <= 0 || width <= 0) {
                 return {
                    schematicData: createSchematicData(`Shape: ${shape.type}`, {width, height}),
                    width,
                    height,
                    pixels,
                };
            }

            const apexCenter = (width - 1) / 2 + shape.apexOffset;
            
            const line = (pA: {x: number, y: number}, pB: {x: number, y: number}) => {
                let x0 = Math.round(pA.x), y0 = Math.round(pA.y);
                let x1 = Math.round(pB.x), y1 = Math.round(pB.y);
                let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
                let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
                let err = dx + dy, e2;
                const points = [];
                for (;;) {
                    points.push({x: x0, y: y0});
                    if (x0 === x1 && y0 === y1) break;
                    e2 = 2 * err;
                    if (e2 >= dy) { err += dy; x0 += sx; }
                    if (e2 <= dx) { err += dx; y0 += sy; }
                }
                return points;
            }
            
            const p1 = { x: apexCenter, y: 0 };
            const p2 = { x: 0, y: height - 1 };
            const p3 = { x: width - 1, y: height - 1 };

            const leftLine = line(p1, p2);
            const rightLine = line(p1, p3);

            const edges: { [key: number]: { min: number, max: number } } = {};

            for(const point of [...leftLine, ...rightLine]) {
                if(!edges[point.y]) edges[point.y] = { min: point.x, max: point.x };
                edges[point.y].min = Math.min(edges[point.y].min, point.x);
                edges[point.y].max = Math.max(edges[point.y].max, point.x);
            }
            
            for (let y = 0; y < height; y++) {
                if (edges[y]) {
                    for (let x = edges[y].min; x <= edges[y].max; x++) {
                        if (x >= 0 && x < width) {
                            pixels[y * width + x] = true;
                        }
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
        const data = imageData.data;
        const pixels: (boolean | number)[] = [];
        
        if (mode === 'bw') {
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                pixels.push(grayscale(r, g, b) < threshold);
            }
            return { schematicData, width, height, pixels };

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
             return { schematicData, width, height, pixels, palette };
        }

    } catch(err) {
        throw new Error(`Failed to process image data: ${err}`);
    }
}


/**
 * Generates a .vox file for a given 3D shape using the vox-saver library.
 */
export function voxToSchematic(shape: VoxShape): SchematicOutput {
    const voxels: {x: number, y: number, z: number, i: number}[] = [];
    let width: number, height: number, depth: number;
    let name = `VOX Shape: ${shape.type}`;
    
    // In our app, Y is up. MagicaVoxel and vox-saver expect Z to be up.
    // We will generate with our coordinate system and then swap y/z for the library.
    const addVoxel = (x: number, y: number, z: number) => {
        // The color index is 1, which maps to the first color in our palette.
        voxels.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), i: 1 });
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
            width = depth = shape.radius * 2;
            height = shape.height;
            const diskCenter = shape.radius;
            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                  for (let x = 0; x < width; x++) {
                      const dx = x - diskCenter + 0.5;
                      const dz = z - diskCenter + 0.5;
                      if (dx * dx + dz * dz <= shape.radius * shape.radius) {
                          addVoxel(x, y, z);
                      }
                  }
              }
            }
            break;
    }
    
    // The color is our accent color, #C8A464 -> RGB(200, 164, 100)
    // The library expects a full 256 color palette. We'll fill it with a default color.
    const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
    palette[0] = { r: 200, g: 164, b: 100, a: 255 };
    
    const voxObject = {
        size: { x: width, y: depth, z: height }, // Z is up in .vox format, so we map our depth to Y and height to Z
        xyzi: {
            numVoxels: voxels.length,
            // .vox format is Z-up, so we swap our y and z
            values: voxels.map(v => ({ x: v.x, y: v.z, z: v.y, i: v.i }))
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

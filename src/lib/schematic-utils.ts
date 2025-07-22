

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
        case 'circle': {
            width = height = shape.radius * 2;
            if (shape.radius <= 0) {
                pixels = [];
                break;
            };

            const centerX = width / 2.0;
            const centerY = height / 2.0;
            const r = shape.radius;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const dx = px - centerX;
                    const dy = py - centerY;
                    pixels.push(dx * dx + dy * dy < r * r);
                }
            }
            break;
        }

        case 'triangle': {
            width = shape.base;
            height = shape.height;
            pixels = Array(width * height).fill(false);
            
            if (height > 0 && width > 0) {
                const geometricCenterX = (width / 2.0) + shape.apexOffset;

                for (let y = 0; y < height; y++) {
                    const progress = height > 1 ? y / (height - 1) : 1;
                    const currentWidth = progress * width;
                    
                    const startX = geometricCenterX - currentWidth / 2.0;
                    const endX = geometricCenterX + currentWidth / 2.0;

                    for (let x = 0; x < width; x++) {
                        const px = x + 0.5;
                        if (px >= startX && px <= endX) {
                            pixels[y * width + x] = true;
                        }
                    }
                }
            }
            break;
        }
            
        case 'rhombus': {
            width = shape.width;
            height = shape.height;
            if (width <= 0 || height <= 0) {
                pixels = [];
                break;
            };

            const centerX = width / 2.0;
            const centerY = height / 2.0;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const dx = Math.abs(px - centerX);
                    const dy = Math.abs(py - centerY);
                    pixels.push((dx / (width / 2.0)) + (dy / (height / 2.0)) <= 1);
                }
            }
            break;
        }

        case 'hexagon': {
            const r = shape.radius;
            if (r <= 0) {
                width = 0;
                height = 0;
                pixels = [];
                break;
            }
            // Flat-topped hexagon
            width = r * 2;
            height = Math.round(Math.sqrt(3) * r);
            pixels = Array(width * height).fill(false);
            const centerX = width / 2.0;
            const centerY = height / 2.0;
            const sideLength = r;

            for (let y = 0; y < height; y++) {
                const py = y + 0.5;
                const dy = Math.abs(py - centerY);
                
                // Calculate width at this y level
                let currentWidth;
                if (dy <= height / 2) {
                   currentWidth = sideLength * (1 + (height / 2 - dy) / (height / 2));
                   currentWidth = Math.min(width, currentWidth);
                } else {
                    currentWidth = 0;
                }
                if (dy * 2 > Math.sqrt(3) * r) {
                  currentWidth = 2 * r - (2 * dy / Math.sqrt(3)) * r;
                } else {
                  currentWidth = 2*r;
                }
                const ratio = Math.abs( (y - centerY + 0.5) / (height/2) );
                const w = width - Math.floor(ratio * width/2)*2;


                const startX = centerX - w / 2.0;
                const endX = centerX + w / 2.0;

                for (let x = 0; x < width; x++) {
                    const px = x + 0.5;
                     if (px >= startX && px <= endX) {
                        const relX = Math.abs(px - centerX);
                        const relY = Math.abs(py - centerY);
                        if (relX * 0.57735 + relY <= r * 0.866025) { // Sqrt(3)/2
                           pixels[y * width + x] = true;
                        }
                    }
                }
            }
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const py = y + 0.5 - centerY;
                    const px = x + 0.5 - centerX;

                    const q2 = (2/3) * px;
                    const r2 = (-1/3) * px + (Math.sqrt(3)/3) * py;

                    if(Math.abs(q2) + Math.abs(r2) + Math.abs(-q2-r2) <= sideLength * 2) {
                       // pixels[y*width+x] = true;
                    }
                }
            }

            const hexHeight = Math.sqrt(3) * r;

            for (let y_scan = 0; y_scan < height; y_scan++) {
                const y_rel = y_scan + 0.5 - centerY;

                // Calculate the width of the hexagon at this y
                let x_width;
                if (Math.abs(y_rel) > hexHeight / 2) {
                    x_width = 0; // Outside the hexagon
                } else if (Math.abs(y_rel) > hexHeight / 4) {
                    // Sloped part
                    x_width = (hexHeight / 2 - Math.abs(y_rel)) * (2 / Math.sqrt(3)) * 2;
                } else {
                    // Flat part
                    x_width = r * 2;
                }
                x_width = 2*r - (2*Math.abs(y_rel) / Math.sqrt(3));
                
                const startX = centerX - x_width / 2;
                const endX = centerX + x_width / 2;

                for (let x = 0; x < width; x++) {
                    if (x + 0.5 >= startX && x + 0.5 <= endX) {
                        pixels[y_scan * width + x] = true;
                    }
                }
            }
            break;
        }
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

    





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
        // Fallback to a default font if loading fails
        loadedFontFamily = '"Roboto Condensed", sans-serif';
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    ctx.font = `${fontSize}px ${loadedFontFamily}`;
    const metrics = ctx.measureText(text);
    
    const textWidth = Math.ceil(metrics.width) || 1;
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
    const textHeight = Math.ceil(ascent + descent) || 1;
    
    if (textWidth === 0 || textHeight === 0) {
      return {
        schematicData: createSchematicData(`Empty Text`, {width: 0, height: 0}),
        width: 0,
        height: 0,
        pixels: [],
      };
    }
    
    const PADDING = outline ? 2 : 0; // 1px gap + 1px outline
    const width = textWidth + PADDING * 2;
    const height = textHeight + PADDING * 2;

    canvas.width = width;
    canvas.height = height;
    
    // Re-apply font settings after resize
    ctx.font = `${fontSize}px ${loadedFontFamily}`;
    ctx.fillStyle = '#F0F0F0';
    ctx.textBaseline = 'top';
    ctx.fillText(text, PADDING, PADDING);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels: boolean[] = Array(width * height).fill(false);

    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 128) {
            pixels[i / 4] = true;
        }
    }
    
    if (outline) {
        const outlinePixels = Array(width * height).fill(false);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (pixels[y * width + x]) {
                    continue; // Skip original text pixels
                }

                // Check neighbors for a text pixel to determine if this is an outline pixel
                let isOutline = false;
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        // Check if it's in the 1-pixel-away gap
                        const isGap = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
                        if (isGap) continue;

                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (pixels[ny * width + nx]) {
                                isOutline = true;
                                break;
                            }
                        }
                    }
                    if (isOutline) break;
                }
                 if (isOutline) {
                    // Make sure we're not filling in a gap pixel
                    let isGap = false;
                     for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height && pixels[ny * width + nx]) {
                                isGap = true;
                                break;
                            }
                        }
                        if(isGap) break;
                     }
                     if(!isGap) {
                        outlinePixels[y * width + x] = true;
                     }
                }
            }
        }
        
        // Combine original text and outline
        for (let i = 0; i < pixels.length; i++) {
            if (outlinePixels[i]) {
                pixels[i] = true;
            }
        }
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
            
            for (let y_scan = 0; y_scan < height; y_scan++) {
                const y_rel = y_scan + 0.5 - centerY;
                
                // For a flat-topped hexagon, the width at a given y is related to its distance from the center.
                // The max width is 2*r at the center (y_rel = 0). It decreases linearly to r at the top/bottom.
                // This formula calculates the horizontal distance from the center to the edge at a given y.
                const x_dist_abs = r * (1 - Math.abs(y_rel) / (Math.sqrt(3) * r / 2)) * 0.5;
                const x_dist = r * (Math.sqrt(3)/2 - Math.abs(y_rel) / r) * (1/Math.sin(Math.PI/3));
                const h_dist = (Math.sqrt(3) * r / 2 - Math.abs(y_rel)) / Math.sqrt(3);

                const q2x = Math.abs(y_rel) / Math.tan(Math.PI/3);


                const w_y = width * (1 - (Math.abs(y_rel) / (height / 2.0)));
                 const startX_y = centerX - w_y / 2.0;
                 const endX_y = centerX + w_y / 2.0;
                 
                
                const startX = centerX - x_dist_abs;
                const endX = centerX + x_dist_abs;

                 for (let x = 0; x < width; x++) {
                    const px = x + 0.5;
                    const dx_abs = Math.abs(px - centerX);
                    if (dx_abs / (r) +  Math.abs(y_rel) / (height/2) <= 1)
                     pixels[y_scan * width + x] = true;
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

    



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
export type TextOrientation = 'horizontal' | 'vertical-lr';

type HemispherePart = `hemisphere-${'top' | 'bottom' | 'vertical'}`;
type DiskOrientation = 'horizontal' | 'vertical';
type ArchType = 'rectangular' | 'rounded' | 'circular';
type CircularArchOrientation = 'top' | 'bottom';


type ArchRectangular = { archType: 'rectangular', width: number, height: number, depth: number, outerCornerRadius?: 0 };
type ArchRounded = { archType: 'rounded', width: number, height: number, depth: number, outerCornerRadius: number };
type ArchCircular = { archType: 'circular', width: number, thickness: number, depth: number, orientation: CircularArchOrientation };


export type VoxShape = 
    | { type: 'cuboid', width: number, height: number, depth: number }
    | { type: 'sphere', radius: number, part?: 'full' | HemispherePart }
    | { type: 'pyramid', base: number, height: number }
    | { type: 'cone', radius: number, height: number }
    | { 
        type: 'column', 
        radius: number, 
        height: number,
        withBase?: boolean,
        baseRadius?: number,
        baseHeight?: number,
        brokenTop?: boolean,
        breakAngle?: number,
      }
    | ({ type: 'arch' } & (ArchRectangular | ArchRounded | ArchCircular))
    | { type: 'disk', radius: number, height: number, part?: 'full' | 'half', orientation: DiskOrientation }
    | { type: 'ring', radius: number, thickness: number, height: number, part?: 'full' | 'half', orientation: DiskOrientation };


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

interface RasterizeTextParams {
  text: string;
  font: FontStyle;
  fontSize: number;
  fontUrl?: string;
  outline?: boolean;
  outlineGap?: number;
  orientation?: TextOrientation;
}

export async function rasterizeText({
  text,
  font,
  fontSize,
  fontUrl,
  outline = false,
  outlineGap = 1,
  orientation = 'horizontal',
}: RasterizeTextParams): Promise<{ pixels: boolean[], width: number, height: number }> {
    if (typeof document === 'undefined' || !text || !text.trim()) {
        return { width: 0, height: 0, pixels: [] };
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
    
    // Create a temporary canvas to measure text
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    tempCtx.font = `${fontSize}px ${loadedFontFamily}`;

    const metrics = tempCtx.measureText(text);
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize;
    const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
    const totalHeight = Math.ceil(ascent + descent);
    const totalWidth = Math.ceil(metrics.width);
    
    if (totalWidth <= 0 || totalHeight <= 0) {
        if (fontFace && document.fonts.has(fontFace)) {
            document.fonts.delete(fontFace);
        }
        return { width: 0, height: 0, pixels: [] };
    }
    
    // Create a working canvas with enough padding for the outline and measurement inaccuracies
    const PADDING = (outline ? (outlineGap ?? 1) : 0) + 5; 
    const contentWidth = totalWidth + PADDING * 2;
    const contentHeight = totalHeight + PADDING * 2;
    
    const workCanvas = document.createElement('canvas');
    workCanvas.width = contentWidth;
    workCanvas.height = contentHeight;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true })!;
    
    // Draw the text onto the working canvas
    ctx.font = `${fontSize}px ${loadedFontFamily}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top'; 
    ctx.fillText(text, PADDING, PADDING);
    
    // Cleanup custom font
    if (fontFace && document.fonts.has(fontFace)) {
        document.fonts.delete(fontFace);
    }
    
    // Get pixel data from the working canvas
    const imageData = ctx.getImageData(0, 0, contentWidth, contentHeight);
    const data = imageData.data;

    // Create a boolean array for the text pixels
    const textPixels = Array(contentWidth * contentHeight).fill(false);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 128) { // Check alpha channel
            textPixels[i / 4] = true;
        }
    }
    
    let combinedPixels = textPixels;

    if (outline) {
        const outlinePixels = Array(contentWidth * contentHeight).fill(false);
        const distanceCheck = (outlineGap ?? 1); 

        for (let y = 0; y < contentHeight; y++) {
            for (let x = 0; x < contentWidth; x++) {
                if (textPixels[y * contentWidth + x]) { 
                    continue; // Skip pixels that are part of the text
                }
                
                let minDistanceSq = Infinity;
                
                // Heuristic to limit search area for performance
                const searchBox = distanceCheck + 2;
                const startY = Math.max(0, y - searchBox);
                const endY = Math.min(contentHeight - 1, y + searchBox);
                const startX = Math.max(0, x - searchBox);
                const endX = Math.min(contentWidth - 1, x + searchBox);

                for (let y2 = startY; y2 <= endY; y2++) {
                    for (let x2 = startX; x2 <= endX; x2++) {
                        if (textPixels[y2 * contentWidth + x2]) {
                            const distSq = Math.pow(x - x2, 2) + Math.pow(y - y2, 2);
                            minDistanceSq = Math.min(minDistanceSq, distSq);
                        }
                    }
                }
                
                const minDistance = Math.sqrt(minDistanceSq);
                
                // Check if the pixel is within the outline stroke (1px wide)
                if (minDistance > distanceCheck && minDistance <= distanceCheck + 1.2) { // Use 1.2 to fill gaps
                     outlinePixels[y * contentWidth + x] = true;
                }
            }
        }
        
        combinedPixels = textPixels.map((p, i) => p || outlinePixels[i]);
    }

    // Crop the combined pixels to their actual bounding box
    let minX = contentWidth, minY = contentHeight, maxX = -1, maxY = -1;
    for(let y = 0; y < contentHeight; y++) {
        for (let x = 0; x < contentWidth; x++) {
            if (combinedPixels[y * contentWidth + x]) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    
    if (maxX === -1) { // Empty schematic
       return { width: 0, height: 0, pixels: [] };
    }
    
    const croppedWidth = maxX - minX + 1;
    const croppedHeight = maxY - minY + 1;
    const croppedPixels = Array(croppedWidth * croppedHeight).fill(false);
    
    for(let y = 0; y < croppedHeight; y++) {
        for(let x = 0; x < croppedWidth; x++) {
            croppedPixels[y * croppedWidth + x] = combinedPixels[(y + minY) * contentWidth + (x + minX)];
        }
    }

    return { pixels: croppedPixels, width: croppedWidth, height: croppedHeight };
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
   
    const { pixels: croppedPixels, width: croppedWidth, height: croppedHeight } = await rasterizeText({ text, font, fontSize, fontUrl, outline, outlineGap});
    
     if (croppedWidth === 0) { // Empty schematic
        return {
            schematicData: createSchematicData(`Empty Text`, {width: 0, height: 0}),
            width: 0,
            height: 0,
            pixels: [],
        };
    }

    // Align to chunk grid
    const finalWidth = Math.ceil(croppedWidth / 16) * 16;
    const finalHeight = Math.ceil(croppedHeight / 16) * 16;
    const finalPixels = Array(finalWidth * finalHeight).fill(false);
    
    const xOffset = Math.floor((finalWidth - croppedWidth) / 2);
    const yOffset = Math.floor((finalHeight - croppedHeight) / 2);
    
    for(let y = 0; y < croppedHeight; y++) {
        for (let x = 0; x < croppedWidth; x++) {
            if (croppedPixels[y * croppedWidth + x]) {
                finalPixels[(y + yOffset) * finalWidth + (x + xOffset)] = true;
            }
        }
    }

    return {
        schematicData: createSchematicData(`Text: "${text}"`, {width: finalWidth, height: finalHeight}),
        width: finalWidth,
        height: finalHeight,
        pixels: finalPixels,
        originalWidth: croppedWidth,
        originalHeight: croppedHeight
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
        for(let x = 0; x < contentWidth; x++) {
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
    let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
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
        
        case 'column': {
            const { 
                radius: colRadius, 
                height: colHeight, 
                withBase = false,
                baseRadius = 0,
                baseHeight = 0,
                brokenTop = false,
                breakAngle = 45,
            } = shape;
            
            width = depth = Math.max(colRadius * 2, withBase ? baseRadius * 2 : 0);
            height = (withBase ? baseHeight : 0) + colHeight;
            const shaftCenter = width / 2;

            let voxels = new Set<string>();

            // Generate detailed base
            if (withBase && baseHeight > 0 && baseRadius > 0) {
                const baseLayers = [
                    { h: Math.ceil(baseHeight * 0.4), r: baseRadius },
                    { h: Math.ceil(baseHeight * 0.3), r: baseRadius * 0.9 },
                    { h: baseHeight - Math.ceil(baseHeight * 0.4) - Math.ceil(baseHeight * 0.3), r: baseRadius * 0.8 },
                ];
                
                let currentY = 0;
                for(const layer of baseLayers) {
                    const layerHeight = Math.max(1, layer.h);
                    for (let y = currentY; y < currentY + layerHeight; y++) {
                        for (let z = 0; z < width; z++) {
                            for (let x = 0; x < width; x++) {
                                const dx = x - shaftCenter + 0.5;
                                const dz = z - shaftCenter + 0.5;
                                if (dx * dx + dz * dz <= layer.r * layer.r) {
                                    voxels.add(`${x},${y},${z}`);
                                }
                            }
                        }
                    }
                    currentY += layerHeight;
                }
            }

            // Generate shaft
            const shaftStartY = withBase ? baseHeight : 0;
            for (let y = shaftStartY; y < height; y++) {
                for (let z = 0; z < width; z++) {
                    for (let x = 0; x < width; x++) {
                         const dx = x - shaftCenter + 0.5;
                         const dz = z - shaftCenter + 0.5;
                         if (dx * dx + dz * dz <= colRadius * colRadius) {
                            voxels.add(`${x},${y},${z}`);
                         }
                    }
                }
            }
            
            // Break top with an angled slice
            if (brokenTop && breakAngle) {
                const tanAngle = Math.tan(breakAngle * Math.PI / 180);
                // The plane equation: y = tan(angle) * x + c. We start the cut from one edge.
                const slicePlane = (x: number, y: number) => {
                    return y - (height - colRadius) > tanAngle * (x - (shaftCenter - colRadius));
                };

                let voxelsToRemove = new Set<string>();
                voxels.forEach(v => {
                    const [x, y, z] = v.split(',').map(Number);
                    if (slicePlane(x, y)) {
                        voxelsToRemove.add(v);
                    }
                });
                voxelsToRemove.forEach(v => voxels.delete(v));
            }

            // Add final voxels from set
            voxels.forEach(v => {
                const [x, y, z] = v.split(',').map(Number);
                addVoxel(x, y, z);
            });
            break;
        }
        
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
        
        case 'arch': {
             depth = shape.depth;
             if (shape.archType === 'circular') {
                width = shape.width;
                const outerRadius = width / 2;
                height = outerRadius;
                const innerRadius = outerRadius - shape.thickness;
                const centerX = (width - 1) / 2.0;
                
                for (let z = 0; z < depth; z++) {
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                             const dx = x - centerX;
                             const dy = shape.orientation === 'top' ? y - (height -1) : -y;
                             const distSq = dx * dx + dy * dy;

                             if (distSq <= outerRadius * outerRadius && distSq > innerRadius * innerRadius) {
                                addVoxel(x, y, z);
                             }
                        }
                    }
                }
            } else { // Rectangular or Rounded
                width = shape.width;
                height = shape.height;
                const archRadius = shape.width / 2.0;
                const centerX = (shape.width - 1) / 2.0;

                for (let y = 0; y < height; y++) {
                  for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                      let shouldPlace = false;
                      const innerDx = x - centerX;
                      const innerDy = y - (height - archRadius);
                      const isOutsideInnerCutout = innerDx * innerDx + innerDy * innerDy >= archRadius * archRadius;
                      
                      if (y < height - archRadius) {
                          shouldPlace = true;
                      } else {
                         if (isOutsideInnerCutout) {
                            shouldPlace = true;
                         }
                      }
                      
                      const outerCornerRadius = shape.outerCornerRadius ?? 0;
                      if (shouldPlace && shape.archType === 'rounded' && outerCornerRadius > 0 && y >= height - outerCornerRadius) {
                          if (x < outerCornerRadius) {
                              const outerDx = x - outerCornerRadius + 0.5;
                              const outerDy = y - (height - outerCornerRadius) + 0.5;
                              if (outerDx * outerDx + outerDy * outerCornerRadius > outerCornerRadius * outerCornerRadius) {
                                  shouldPlace = false;
                              }
                          }
                          if (x > width - 1 - outerCornerRadius) {
                              const outerDx = x - (width - 1 - outerCornerRadius) - 0.5;
                              const outerDy = y - (height - outerCornerRadius) + 0.5;
                               if (outerDx * outerDx + outerDy * outerDy > outerCornerRadius * outerCornerRadius) {
                                  shouldPlace = false;
                              }
                          }
                      }

                      if (shouldPlace) {
                          addVoxel(x, y, z);
                      }
                    }
                  }
                }
            }
            break;
        }

        case 'disk': {
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
        case 'ring': {
            const { radius: outerR, thickness, height: ringHeight, part: ringPart = 'full', orientation: ringOrientation = 'horizontal' } = shape;
            const innerR = outerR - thickness;

            if (ringOrientation === 'vertical') {
                width = ringHeight;
                height = outerR * 2;
                depth = outerR * 2;
            } else { // horizontal
                width = outerR * 2;
                height = ringHeight;
                depth = outerR * 2;
            }

            const ringCenterY = ringOrientation === 'vertical' ? outerR : ringHeight / 2;
            const ringCenterZ = outerR;
            const ringCenterX = ringOrientation === 'vertical' ? ringHeight/2 : outerR;
            
            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                  for (let x = 0; x < width; x++) {
                      let distSq: number;
                      
                      if (ringOrientation === 'vertical') {
                          const dy = y - ringCenterY + 0.5;
                          const dz = z - ringCenterZ + 0.5;
                          distSq = dy * dy + dz * dz;
                      } else {
                          const dx = x - ringCenterX + 0.5;
                          const dz = z - ringCenterZ + 0.5;
                          distSq = dx * dx + dz * dz;
                      }

                      if (distSq <= outerR * outerR && distSq > innerR * innerR) {
                           if (ringPart === 'full') {
                              addVoxel(x, y, z);
                          } else if (ringPart === 'half') {
                              if (ringOrientation === 'horizontal' && z < ringCenterZ) {
                                  addVoxel(x, y, z);
                              } else if (ringOrientation === 'vertical' && y < ringCenterY) {
                                  addVoxel(x, y, z);
                              }
                          }
                      }
                  }
              }
            }
            break;
        }
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




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
  depth: number;
  pixels: (boolean | number)[];
  isVox?: boolean;
  voxData?: Uint8Array;
  palette?: PaletteColor[];
  originalWidth?: number;
  originalHeight?: number;
  voxSize?: {x: number, y: number, z: number};
  totalVoxels?: number;
}

export type FontStyle = 'monospace' | 'serif' | 'sans-serif' | 'custom';
export type Shape = 'circle' | 'triangle' | 'rhombus' | 'hexagon';
export type TextOrientation = 'horizontal' | 'vertical-lr';

type HemispherePart = `hemisphere-${'top' | 'bottom' | 'vertical'}`;
type DiskOrientation = 'horizontal' | 'vertical';
type ArchType = 'rectangular' | 'rounded' | 'circular';
type CircularArchOrientation = 'top' | 'bottom';
export type ColumnStyle = 'simple' | 'decorative';


type ArchRectangular = { archType: 'rectangular', width: number, height: number, depth: number, outerCornerRadius?: 0 };
type ArchRounded = { archType: 'rounded', width: number, height: number, depth: number, outerCornerRadius: number };
type ArchCircular = { archType: 'circular', width: number, thickness: number, depth: number, orientation: CircularArchOrientation };


export type VoxShape = 
    | { type: 'cuboid', width: number, height: number, depth: number }
    | { type: 'sphere', radius: number, part?: 'full' | HemispherePart, carveMode?: boolean, hollow?: boolean, thickness?: number }
    | { type: 'pyramid', base: number, height: number }
    | { type: 'cone', radius: number, height: number }
    | { 
        type: 'column', 
        radius: number, 
        height: number,
        withBase?: boolean,
        withCapital?: boolean,
        baseRadius?: number,
        baseHeight?: number,
        baseStyle?: ColumnStyle,
        capitalStyle?: ColumnStyle,
        brokenTop?: boolean,
        withDebris?: boolean,
        debrisLength?: number,
        breakAngleX?: number,
        breakAngleZ?: number,
      }
    | ({ type: 'arch' } & (ArchRectangular | ArchRounded | ArchCircular))
    | { type: 'disk', radius: number, height: number, part?: 'full' | 'half', orientation: DiskOrientation }
    | { type: 'ring', radius: number, thickness: number, height: number, part?: 'full' | 'half', orientation: DiskOrientation }
    | { type: 'qrcode', pixels: boolean[], size: number, depth: number, withBackdrop?: boolean, backdropDepth?: number, stickerMode?: boolean }
    | { type: 'checkerboard', width: number, length: number, height: number }
    | { type: 'haystack', radius: number, height: number }
    | { type: 'corner', radius: number, height: number, external: boolean, internal: boolean };


// A simple helper to generate schematic data string
function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const { width, height, depth } = dimensions;
    const depthInfo = depth ? `x${depth}`: '';

    const xChunks = Math.ceil(width / 16);
    const yChunks = Math.ceil(height / 16);
    const zChunks = depth ? Math.ceil(depth / 16) : 1;
    const totalChunks = xChunks * yChunks * zChunks;

    return `Schematic: ${name} (${width}x${height}${depthInfo})`;
}

interface RasterizeTextParams {
  text: string;
  font?: FontStyle;
  fontSize?: number;
  fontUrl?: string;
  outline?: boolean;
  outlineGap?: number;
  outlineWidth?: number;
  orientation?: TextOrientation;
  maxWidth?: number;
}

export async function rasterizeText({
  text,
  font,
  fontSize,
  fontUrl,
  outline = false,
  outlineGap = 1,
  outlineWidth = 1,
  orientation = 'horizontal',
  maxWidth,
}: RasterizeTextParams): Promise<{ pixels: boolean[], width: number, height: number }> {
    if (typeof document === 'undefined' || !text || !text.trim()) {
        return { width: 0, height: 0, pixels: [] };
    }

    const fontName = fontUrl?.split('/').pop()?.split('.')[0] || 'custom-font';
    let loadedFontFamily = font;

    let fontFace: FontFace | undefined;
    if (fontUrl && font === 'custom') {
      fontFace = new FontFace(fontName, `url(${fontUrl})`);
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
        loadedFontFamily = fontName;
      } catch (e) {
        console.error('Font loading failed:', e);
        // Fallback or re-throw
        throw new Error(`Failed to load font: ${fontUrl}`);
      }
    }
    
    // Create a temporary canvas to measure text
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    tempCtx.font = `${fontSize}px ${loadedFontFamily}`;
    
    // Word wrapping logic
    const words = text.split(' ');
    let lines: string[] = [];
    let currentLine = words[0] || '';

    if (maxWidth) {
        for (let i = 1; i < words.length; i++) {
            let testLine = currentLine + ' ' + words[i];
            let metrics = tempCtx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
    } else {
        currentLine = text;
    }
    lines.push(currentLine);

    const lineMetrics = lines.map(line => tempCtx.measureText(line));
    const totalWidth = Math.ceil(Math.max(...lineMetrics.map(m => m.width)));
    const ascent = Math.max(...lineMetrics.map(m => m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontSize));
    const descent = Math.max(...lineMetrics.map(m => m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? 0));
    const lineHeight = Math.ceil(ascent + descent);
    const totalHeight = lineHeight * lines.length;

    
    if (totalWidth <= 0 || totalHeight <= 0) {
        if (fontFace && document.fonts.has(fontFace)) {
            document.fonts.delete(fontFace);
        }
        return { width: 0, height: 0, pixels: [] };
    }
    
    // Create a working canvas with enough padding for the outline and measurement inaccuracies
    const PADDING = (outline ? (outlineGap ?? 1) + (outlineWidth ?? 1) : 0) + 5; 
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
    
    if(outline) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = outlineWidth * 2; // Create stroke from center
      ctx.lineJoin = 'round';
      lines.forEach((line, i) => {
          ctx.strokeText(line, PADDING + (outlineGap ?? 1), PADDING + i * lineHeight + (outlineGap ?? 1));
      });
    }

    lines.forEach((line, i) => {
        ctx.fillText(line, PADDING, PADDING + i * lineHeight);
    });
    
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

    if (orientation === 'vertical-lr') {
        const rotatedPixels = Array(croppedWidth * croppedHeight).fill(false);
        const rotatedWidth = croppedHeight;
        const rotatedHeight = croppedWidth;
        for (let y = 0; y < croppedHeight; y++) {
            for (let x = 0; x < croppedWidth; x++) {
                if (croppedPixels[y * croppedWidth + x]) {
                    rotatedPixels[x * rotatedWidth + (rotatedWidth - 1 - y)] = true;
                }
            }
        }
        return { pixels: rotatedPixels, width: rotatedWidth, height: rotatedHeight };
    }

    return { pixels: croppedPixels, width: croppedWidth, height: croppedHeight };
}

// Map for a 5px height pixel font inside a 7px canvas. 1 represents a pixel.
const TINY_FONT_DATA: Record<string, number[][]> = {
    'A': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
    'B': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0],[0,0,0,0]],
    'C': [[0,0,0,0],[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1],[0,0,0,0]],
    'D': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0],[0,0,0,0]],
    'E': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1],[0,0,0,0]],
    'F': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
    'G': [[0,0,0,0],[0,1,1,1],[1,0,0,0],[1,0,1,1],[1,0,0,1],[0,1,1,1],[0,0,0,0]],
    'H': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
    'I': [[0,0,0],[0,1,1,1],[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,1,1,1],[0,0,0]],
    'J': [[0,0,0,0],[0,0,1,1],[0,0,0,1],[0,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    'K': [[0,0,0,0],[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1],[0,0,0,0]],
    'L': [[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1],[0,0,0,0]],
    'M': [[0,0,0,0,0],[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
    'N': [[0,0,0,0],[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
    'O': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    'P': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
    'Q': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,1,1],[0,1,1,1],[0,0,0,0]],
    'R': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1],[0,0,0,0]],
    'S': [[0,0,0,0],[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
    'T': [[0,0,0,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,0,0,0]],
    'U': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    'V': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,0,1],[0,0,1,0],[0,0,0,0]],
    'W': [[0,0,0,0,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1],[0,0,0,0,0]],
    'X': [[0,0,0,0],[1,0,0,1],[0,1,1,0],[0,0,1,0],[0,1,1,0],[1,0,0,1],[0,0,0,0]],
    'Y': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
    'Z': [[0,0,0,0],[1,1,1,1],[0,0,1,0],[0,1,0,0],[1,0,0,0],[1,1,1,1],[0,0,0,0]],
    '0': [[0,0,0,0],[0,1,1,0],[1,0,1,1],[1,1,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    '1': [[0,0,0],[0,1,1,0],[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,1,1,1],[0,0,0,0]],
    '2': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[0,0,1,0],[0,1,0,0],[1,1,1,1],[0,0,0,0]],
    '3': [[0,0,0,0],[1,1,1,0],[0,0,0,1],[0,1,1,0],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
    '4': [[0,0,0,0],[1,0,1,0],[1,0,1,0],[1,1,1,1],[0,0,1,0],[0,0,1,0],[0,0,0,0]],
    '5': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,1,1,0],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
    '6': [[0,0,0,0],[0,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    '7': [[0,0,0,0],[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
    '8': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[0,1,1,0],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
    '9': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[0,1,1,1],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
    ' ': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],
    '.': [[0],[0],[0],[0],[0],[0],[1]],
    ',': [[0,0],[0,0],[0,0],[0,0],[0,0],[1,0],[0,1]],
    '!': [[0],[0],[1],[1],[1],[0],[1]],
    '?': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[0,0,1,0],[0,0,0,0],[0,0,1,0],[0,0,0,0]],
    '(': [[0,0],[0,1],[1,0],[1,0],[1,0],[0,1],[0,0]],
    ')': [[0,0],[1,0],[0,1],[0,1],[0,1],[1,0],[0,0]],
    '/': [[0,0,0],[0,0,1],[0,1,0],[0,1,0],[1,0,0],[1,0,0],[0,0,0]],
    '\\':[[0,0,0],[1,0,0],[1,0,0],[0,1,0],[0,1,0],[0,0,1],[0,0,0]],
    '+': [[0,0,0],[0,0,0],[0,1,0],[1,1,1],[0,1,0],[0,0,0],[0,0,0]],
    '-': [[0,0,0],[0,0,0],[0,0,0],[1,1,1],[0,0,0],[0,0,0],[0,0,0]],
    '=': [[0,0,0],[0,0,0],[1,1,1],[0,0,0],[1,1,1],[0,0,0],[0,0,0]],
    '_': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0]],
};

// Add Cyrillic glyphs
Object.assign(TINY_FONT_DATA, {
  // Letters that share forms with Latin are left as analogues:
  'А': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
  'В': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0],[0,0,0,0]],
  'Е': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1],[0,0,0,0]],
  'К': [[0,0,0,0],[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1],[0,0,0,0]],
  'М': [[0,0,0,0,0],[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
  'Н': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
  'О': [[0,0,0,0],[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,0,0]],
  'Р': [[0,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
  'С': [[0,0,0,0],[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1],[0,0,0,0]],
  'Т': [[0,0,0,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,0,0,0]],
  'У': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],
  'Х': [[0,0,0,0],[1,0,0,1],[0,1,1,0],[0,0,1,0],[0,1,1,0],[1,0,0,1],[0,0,0,0]],

  // Unique forms:
  'Б': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[0,0,0,0]],
  'Г': [[0,0,0,0],[1,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]],
  'Д': [[0,0,0,0,0],[0,1,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[1,0,0,0,1],[0,0,0,0,0]],
  'Ж': [[0,0,0,0,0],[1,0,1,0,1],[0,1,1,1,0],[0,0,1,0,0],[0,1,1,1,0],[1,0,1,0,1],[0,0,0,0,0]],
  'З': [[0,0,0,0],[1,1,1,0],[0,0,0,1],[0,1,1,0],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
  'И': [[0,0,0,0],[1,0,0,1],[1,0,1,1],[1,1,0,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
  'Й': [[0,1,0,0,0],[1,0,0,1,0],[1,0,1,1,0],[1,1,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,0,0,0,0]], // Accent on top
  'Л': [[0,0,0,0],[0,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
  'П': [[0,0,0,0],[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,0,0,0]],
  'Ф': [[0,0,0,0,0],[1,1,1,1,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]],
  'Ц': [[0,0,0,0,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,0,1]],
  'Ч': [[0,0,0,0],[1,0,0,1],[1,0,0,1],[0,1,1,1],[0,0,0,1],[0,0,0,1],[0,0,0,0]],
  'Ш': [[0,0,0,0,0],[1,0,1,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,1,1,1],[0,0,0,0,0]],
  'Щ': [[0,0,0,0,0],[1,0,1,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,1,1,0],[0,0,0,0,1]],
  'Ъ': [[0,0,0,0,0],[1,1,0,0,0],[0,1,0,0,0],[0,1,1,1,0],[0,1,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
  'Ы': [[0,0,0,0,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,0,1],[1,0,0,1,1],[1,1,1,0,1],[0,0,0,0,0]],
  'Ь': [[0,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,0],[1,0,0,1],[1,1,1,0],[0,0,0,0]],
  'Э': [[0,0,0,0],[1,1,1,0],[0,0,0,1],[0,1,1,1],[0,0,0,1],[1,1,1,0],[0,0,0,0]],
  'Ю': [[0,0,0,0,0],[1,0,1,1,0],[1,0,1,0,1],[1,1,1,0,1],[1,0,1,0,1],[1,0,1,1,0],[0,0,0,0,0]],
  'Я': [[0,0,0,0],[0,1,1,1],[1,0,0,1],[0,1,1,1],[0,1,0,1],[1,0,0,1],[0,0,0,0]],
  'Ё': [[0,1,0,1,0],[1,1,1,1,1],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0]], // Dots on top
});

const normalizeChar = (ch: string): string => {
  return ch.toUpperCase();
};

export async function rasterizePixelText({ text, maxWidth }: { text: string, maxWidth?: number }): Promise<{ pixels: boolean[], width: number, height: number }> {
    const charHeight = 7; // Use the new character canvas height
    const charKerning = 1;
    const maxCharsPerLine = 8;

    const getCharWidth = (char: string): number => {
        const c = normalizeChar(char);
        const data = TINY_FONT_DATA[c] || TINY_FONT_DATA['?'];
        return data[0].length;
    };
    
    const getWordWidth = (word: string): number => {
        let width = 0;
        for (const char of word) {
            width += getCharWidth(char) + charKerning;
        }
        return width > 0 ? width - charKerning : 0;
    };

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if (currentLine.length + (currentLine.length > 0 ? 1 : 0) + word.length > maxCharsPerLine) {
            if(currentLine.length > 0) lines.push(currentLine);
            
            let longWord = word;
            while (longWord.length > maxCharsPerLine) {
                lines.push(longWord.substring(0, maxCharsPerLine));
                longWord = longWord.substring(maxCharsPerLine);
            }
            currentLine = longWord;

        } else {
            if (currentLine.length > 0) {
                currentLine += ' ';
            }
            currentLine += word;
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    const lineMetrics = lines.map(line => ({
        text: line,
        width: getWordWidth(line),
    }));

    const finalWidth = Math.max(...lineMetrics.map(m => m.width));
    const finalHeight = lines.length * (charHeight + charKerning) - charKerning;

    if (finalWidth <= 0 || finalHeight <= 0) {
        return { pixels: [], width: 0, height: 0 };
    }

    const pixels: boolean[] = Array(finalWidth * finalHeight).fill(false);
    
    let currentY = 0;
    for (const line of lineMetrics) {
        let currentX = Math.floor((finalWidth - line.width) / 2);
        for (const rawChar of line.text) {
            const char = normalizeChar(rawChar);
            const data = TINY_FONT_DATA[char] || TINY_FONT_DATA['?'];
            const charWidth = data[0].length;
            for (let y = 0; y < charHeight; y++) {
                for (let x = 0; x < charWidth; x++) {
                    if (data[y] && data[y][x] === 1) {
                        const px = currentX + x;
                        const py = currentY + y;
                        if (px < finalWidth && py < finalHeight) {
                           pixels[py * finalWidth + px] = true;
                        }
                    }
                }
            }
            currentX += charWidth + charKerning;
        }
        currentY += charHeight + charKerning;
    }

    return { pixels, width: finalWidth, height: finalHeight };
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
}: TextToSchematicParams): Promise<Omit<SchematicOutput, 'depth'>> {
   
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
        for(let x = 0; x < croppedWidth; x++) {
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
): Omit<SchematicOutput, 'depth'> {
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
                for (let x = 0; x < contentHeight; x++) {
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
export async function imageToSchematic(ctx: OffscreenCanvasRenderingContext2D, threshold: number, mode: ConversionMode): Promise<Omit<SchematicOutput, 'depth'>> {
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

const generateCylinder = (
    voxels: {x: number, y: number, z: number}[], 
    radius: number, 
    height: number, 
    yOffset: number, 
    xzOffset: number
) => {
    const rSq = radius * radius;
    for (let y = 0; y < height; y++) {
        for (let z = 0; z < radius * 2; z++) {
            for (let x = 0; x < radius * 2; x++) {
                const dx = x - (radius - 0.5);
                const dz = z - (radius - 0.5);
                if (dx * dx + dz * dz <= rSq) {
                    voxels.push({x: x + xzOffset, y: y + yOffset, z: z + xzOffset});
                }
            }
        }
    }
};

const generateDebris = (
    colRadius: number, 
    debrisLength: number, 
    withCapital: boolean,
    baseRadius: number,
    baseHeight: number,
    capitalStyle: ColumnStyle,
    breakAngleX: number,
    breakAngleZ: number
) => {
    let debrisVoxels: {x: number, y: number, z: number}[] = [];
    const mainWidth = Math.max(colRadius, baseRadius) * 2;
    const shaftLength = withCapital ? debrisLength - baseHeight : debrisLength;

    if (withCapital) {
        const capYOffset = shaftLength;
        const capOffset = Math.floor((mainWidth - baseRadius*2) / 2);
         if (capitalStyle === 'simple') {
            generateCylinder(debrisVoxels, baseRadius, baseHeight, capYOffset, capOffset);
        } else {
            // Decorative Capital
            const step1H = Math.round(baseHeight * 0.6);
            const step2H = baseHeight - step1H;
            const step1R = baseRadius;
            const step2R = Math.round(baseRadius * 0.8);
            const step2Offset = Math.floor((step1R - step2R) / 2);
            generateCylinder(debrisVoxels, step1R, step2H, capYOffset + step1H, capOffset);
            generateCylinder(debrisVoxels, step2R, step1H, capYOffset, capOffset + step2Offset);
        }
    }
    
    const xzShaftOffset = Math.floor((mainWidth - colRadius*2) / 2);
    generateCylinder(debrisVoxels, colRadius, shaftLength, 0, xzShaftOffset);
    
    // Apply break plane to the bottom of the debris
    const tanX = Math.tan(breakAngleX * Math.PI / 180);
    const tanZ = Math.tan(breakAngleZ * Math.PI / 180);
    const centerOffset = mainWidth / 2 - 0.5;

    const finalDebris = debrisVoxels.filter(v => {
        const breakPlaneY = -((v.x - centerOffset) * tanX + (v.z - centerOffset) * tanZ);
        return v.y >= breakPlaneY;
    });

    return finalDebris;
};

/**
 * Generates a .vox file for a given 3D shape using the vox-saver library.
 */
export function voxToSchematic(shape: VoxShape): SchematicOutput {
    let xyziValues: {x: number, y: number, z: number, i: number}[] = [];
    let width: number, height: number, depth: number;
    let name = `VOX Shape: ${shape.type}`;
    let totalVoxels = 0;
    
    const addVoxel = (x: number, y: number, z: number, i = 1) => {
        xyziValues.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z), i });
    };
    addVoxel(0,0,0,2); 

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

        case 'sphere': {
            const { radius, part = 'full', carveMode = false, hollow = false, thickness = 1 } = shape;
            const sphereDiameter = radius * 2;
            const center = (sphereDiameter - 1) / 2.0;

            if (carveMode && part.startsWith('hemisphere')) {
                let gridW: number, gridH: number, gridD: number;
                 if (part === 'hemisphere-vertical') {
                    gridW = radius;
                    gridH = sphereDiameter;
                    gridD = sphereDiameter;
                } else { // top or bottom
                    gridW = sphereDiameter;
                    gridH = radius;
                    gridD = sphereDiameter;
                }
                width = gridW; height = gridH; depth = gridD;
                
                const allVoxels: {x: number, y: number, z: number, i: number}[] = [];
                // Create solid block first
                for (let y = 0; y < height; y++) {
                    for (let z = 0; z < depth; z++) {
                        for (let x = 0; x < width; x++) {
                             allVoxels.push({x: x, y: y, z: z, i:1});
                        }
                    }
                }
                
                const carveCenterY = part === 'hemisphere-bottom' ? -0.5 : radius - 0.5;
                const voxelsToRemove = new Set<string>();

                for (let y = 0; y < (part === 'hemisphere-vertical' ? sphereDiameter : radius) ; y++) {
                    for (let z = 0; z < sphereDiameter; z++) {
                        for (let x = 0; x < (part === 'hemisphere-vertical' ? sphereDiameter : radius); x++) {
                            
                            let dx: number, dy: number, dz: number;

                             if (part === 'hemisphere-vertical') {
                                dx = x;
                                dy = y - center;
                                dz = z - center;
                            } else { 
                                dx = x - center;
                                dy = y - carveCenterY;
                                dz = z - center;
                            }
                            
                            const distSq = dx * dx + dy * dy + dz * dz;

                            if (distSq <= radius * radius) {
                               let finalX, finalY, finalZ;
                                if (part === 'hemisphere-vertical') {
                                    finalX = x; finalY = y; finalZ = z;
                                } else if (part === 'hemisphere-top') {
                                    finalX = x; finalY = y; finalZ = z;
                                } else { // bottom
                                    finalX = x; finalY = y; finalZ = z;
                                }
                               voxelsToRemove.add(`${finalX},${finalY},${finalZ}`);
                            }
                        }
                    }
                }
                xyziValues.push(...allVoxels.filter(v => !voxelsToRemove.has(`${v.x},${v.y},${v.z}`)));

            } else {
                 width = height = depth = sphereDiameter;
                 const innerRadius = hollow ? radius - thickness : -1;
                 const innerRadiusSq = innerRadius * innerRadius;
                 const outerRadiusSq = radius * radius;
                 
                 for (let y = 0; y < height; y++) {
                    for (let z = 0; z < depth; z++) {
                        for (let x = 0; x < width; x++) {
                            const dx = x - center;
                            const dy = y - center;
                            const dz = z - center;
                            const distSq = dx * dx + dy * dy + dz * dz;
                            
                            if (distSq <= outerRadiusSq && (!hollow || distSq > innerRadiusSq)) {
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
            }
            break;
        }
            
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
                height: totalHeight,
                withBase = false,
                baseStyle = 'simple',
                capitalStyle = 'simple',
                brokenTop = false,
                withDebris = false,
            } = shape;

            const withCapital = brokenTop ? false : (shape.withCapital ?? false);
            const debrisLength = shape.debrisLength ?? 0;
        
            const baseRadius = shape.baseRadius || Math.round(colRadius * 1.25);
            const baseHeight = shape.baseHeight || Math.max(1, Math.round(colRadius * 0.5));
            const mainColWidth = Math.max(colRadius, baseRadius) * 2;
        
            let mainColumnVoxels: {x: number, y: number, z: number}[] = [];
            
            const finalBaseH = withBase ? baseHeight : 0;
            const finalCapitalH = withCapital ? baseHeight : 0;
            const shaftHeight = totalHeight - finalBaseH - finalCapitalH;
        
            if (withBase) {
                const baseOffset = Math.floor((mainColWidth - baseRadius*2) / 2);
                if (baseStyle === 'simple') {
                    generateCylinder(mainColumnVoxels, baseRadius, finalBaseH, 0, baseOffset);
                } else {
                    const step1H = baseHeight - Math.round(baseHeight * 0.6);
                    const step2H = baseHeight - step1H;
                    const step1R = baseRadius;
                    const step2R = Math.round(baseRadius * 0.8);
                    const step2Offset = Math.floor((step1R - step2R) / 2);
                    generateCylinder(mainColumnVoxels, step1R, step1H, 0, baseOffset);
                    generateCylinder(mainColumnVoxels, step2R, step2H, step1H, baseOffset + step2Offset);
                }
            }
        
            if (withCapital) {
                const capitalOffset = Math.floor((mainColWidth - baseRadius*2) / 2);
                const capitalYOffset = totalHeight - finalCapitalH;
                 if (capitalStyle === 'simple') {
                    generateCylinder(mainColumnVoxels, baseRadius, finalCapitalH, capitalYOffset, capitalOffset);
                } else {
                    const step1H = Math.round(baseHeight * 0.6);
                    const step2H = baseHeight - step1H;
                    const step1R = baseRadius;
                    const step2R = Math.round(baseRadius * 0.8);
                    const step2Offset = Math.floor((step1R - step2R) / 2);
                    generateCylinder(mainColumnVoxels, step1R, step2H, capitalYOffset + step1H, capitalOffset);
                    generateCylinder(mainColumnVoxels, step2R, step1H, capitalYOffset, capitalOffset + step2Offset);
                }
            }
        
            const xzShaftOffset = Math.floor((mainColWidth - colRadius * 2) / 2);
            generateCylinder(mainColumnVoxels, colRadius, shaftHeight, finalBaseH, xzShaftOffset);
        
            if (brokenTop) {
                const breakAngleX = shape.breakAngleX ?? 0;
                const breakAngleZ = shape.breakAngleZ ?? 0;
                const tanX = Math.tan(breakAngleX * Math.PI / 180);
                const tanZ = Math.tan(breakAngleZ * Math.PI / 180);
                const breakPlaneYIntercept = totalHeight;
                const centerOffset = mainColWidth / 2 - 0.5;
        
                mainColumnVoxels = mainColumnVoxels.filter(v => {
                    const breakPlaneY = breakPlaneYIntercept - ((v.x - centerOffset) * tanX + (v.z - centerOffset) * tanZ);
                    return v.y < breakPlaneY;
                });

                if (withDebris) {
                    const debrisVoxels = generateDebris(
                        colRadius, 
                        debrisLength, 
                        shape.withCapital ?? false,
                        baseRadius, 
                        baseHeight, 
                        capitalStyle,
                        breakAngleX,
                        breakAngleZ
                    );

                    let rotatedDebris: {x:number, y:number, z:number}[] = debrisVoxels.map(v => ({
                        x: v.y,
                        y: v.x,
                        z: v.z
                    }));

                    let minRotatedY = Infinity;
                    rotatedDebris.forEach(v => { minRotatedY = Math.min(minRotatedY, v.y); });
                    
                    const debrisXOffset = mainColWidth + 4;

                    rotatedDebris.forEach(v => {
                        addVoxel(debrisXOffset + v.x, v.y - minRotatedY, v.z, 1);
                    });
                }
            }

            xyziValues.push(...mainColumnVoxels.map(v => ({...v, i: 1})));
        
            width = mainColWidth + (withDebris && brokenTop ? (debrisLength) + 4 : 0);
            depth = mainColWidth;
            height = totalHeight;
        
            break;
        }

        case 'cone':
            width = depth = shape.radius * 2;
            height = shape.height;
            const coneCenter = (width - 1) / 2.0;
            for (let y = 0; y < height; y++) {
                const ratio = (height > 1) ? (height - 1 - y) / (height - 1) : 0;
                const currentRadius = shape.radius * ratio;
                for (let z = 0; z < depth; z++) {
                    for (let x = 0; x < width; x++) {
                        const dx = x - coneCenter;
                        const dz = z - coneCenter;
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
                height = Math.floor(outerRadius);
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
                const innerOpeningRadius = shape.width / 2.0;
                const centerX = (shape.width - 1) / 2.0;

                for (let y = 0; y < height; y++) {
                    for (let z = 0; z < depth; z++) {
                        for (let x = 0; x < width; x++) {
                            let shouldPlace = true;

                            // Carve out the inner arch
                            if (y >= height - innerOpeningRadius) {
                                // This part is above the start of the arch curve
                                const innerDx = x - centerX;
                                const innerDy = y - (height - innerOpeningRadius);
                                if (innerDx * innerDx + innerDy * innerDy < innerOpeningRadius * innerOpeningRadius) {
                                    shouldPlace = false;
                                }
                            }
                            
                            const outerCornerRadius = shape.outerCornerRadius ?? 0;
                            if (shouldPlace && shape.archType === 'rounded' && outerCornerRadius > 0) {
                               // Check top-left corner
                                if (x < outerCornerRadius && y >= height - outerCornerRadius) {
                                    const cornerDx = x - outerCornerRadius;
                                    const cornerDy = y - (height - outerCornerRadius);
                                    if (cornerDx * cornerDx + cornerDy * cornerDy >= (outerCornerRadius) * (outerCornerRadius)) {
                                         shouldPlace = false;
                                    }
                                }
                                // Check top-right corner
                                if (x >= width - outerCornerRadius && y >= height - outerCornerRadius) {
                                    const cornerDx = x - (width - outerCornerRadius);
                                    const cornerDy = y - (height - outerCornerRadius);
                                     if (cornerDx * cornerDx + cornerDy * cornerDy >= (outerCornerRadius) * (outerCornerRadius)) {
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
            const { radius, height: diskHeight, part: diskPart = 'full', orientation: diskOrientation = 'horizontal' } = shape;
            
            if (diskOrientation === 'vertical') {
                width = diskHeight;
                height = radius * 2;
                depth = radius * 2;
            } else { // horizontal
                width = radius * 2;
                height = diskHeight;
                depth = radius * 2;
            }
            
            const centerX = (width -1) / 2.0;
            const centerY = (height -1) / 2.0;
            const centerZ = (depth -1) / 2.0;

            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                  for (let x = 0; x < width; x++) {
                      let withinRadius: boolean;
                      
                      if (diskOrientation === 'vertical') {
                          const dy = y - centerY;
                          const dz = z - centerZ;
                          withinRadius = dy * dy + dz * dz <= radius * radius;
                      } else {
                          const dx = x - centerX;
                          const dz = z - centerZ;
                          withinRadius = dx * dx + dz * dz <= radius * radius;
                      }

                      if (withinRadius) {
                           if (diskPart === 'full') {
                              addVoxel(x, y, z);
                          } else if (diskPart === 'half') {
                              if (diskOrientation === 'horizontal' && z < centerZ) {
                                  addVoxel(x, y, z);
                              } else if (diskOrientation === 'vertical' && y < centerY) {
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

            const centerX = (width -1) / 2.0;
            const centerY = (height -1) / 2.0;
            const centerZ = (depth -1) / 2.0;
            
            for (let y = 0; y < height; y++) {
              for (let z = 0; z < depth; z++) {
                  for (let x = 0; x < width; x++) {
                      let distSq: number;
                      
                      if (ringOrientation === 'vertical') {
                          const dy = y - centerY;
                          const dz = z - centerZ;
                          distSq = dy * dy + dz * dz;
                      } else {
                          const dx = x - centerX;
                          const dz = z - centerZ;
                          distSq = dx * dx + dz * dz;
                      }

                      if (distSq <= outerR * outerR && distSq > innerR * innerR) {
                           if (ringPart === 'full') {
                              addVoxel(x, y, z);
                          } else if (ringPart === 'half') {
                              if (ringOrientation === 'horizontal' && z < centerZ) {
                                  addVoxel(x, y, z);
                              } else if (ringOrientation === 'vertical' && y < centerY) {
                                  addVoxel(x, y, z);
                              }
                          }
                      }
                  }
              }
            }
            break;
        }
        
        case 'qrcode': {
            const { pixels, size, withBackdrop, backdropDepth } = shape;
            const qrDepth = shape.depth ?? 1;
            width = size;
            height = size;
            depth = withBackdrop ? 32 : 16;
            
            // Block 1: QR Sticker (z: 0 to 15)
            const qrZOffset = 16 - qrDepth;
            for (let py = 0; py < height; py++) {
               for (let px = 0; px < width; px++) {
                   if (pixels[py * width + px]) {
                       for (let pz = 0; pz < qrDepth; pz++) {
                           addVoxel(px, height - 1 - py, qrZOffset + pz, 1);
                       }
                    }
               }
            }
            
            // Block 2: Mounting Plate (z: 16 to 31)
            if (withBackdrop && backdropDepth && backdropDepth > 0) {
                addVoxel(0, 0, 31, 3); // Anchor for the plate block in the far corner
                const backdropZStart = 16;
                for (let py = 0; py < height; py++) {
                    for (let px = 0; px < width; px++) {
                         for (let pz = 0; pz < backdropDepth; pz++) {
                            addVoxel(px, height - 1 - py, backdropZStart + pz, 1);
                        }
                    }
                }
            }
            break;
        }

        case 'checkerboard': {
            const { width: blockWidth, length: blockLength, height: blockHeight } = shape;
            const VOXEL_SIZE = 16;
            width = blockWidth * VOXEL_SIZE;
            height = blockHeight * VOXEL_SIZE;
            depth = blockLength * VOXEL_SIZE;

            for (let by = 0; by < blockHeight; by++) {
                for (let bz = 0; bz < blockLength; bz++) {
                    for (let bx = 0; bx < blockWidth; bx++) {
                        if ((bx + by + bz) % 2 === 0) {
                            const startX = bx * VOXEL_SIZE;
                            const startY = by * VOXEL_SIZE;
                            const startZ = bz * VOXEL_SIZE;
                            for (let y = startY; y < startY + VOXEL_SIZE; y++) {
                                for (let z = startZ; z < startZ + VOXEL_SIZE; z++) {
                                    for (let x = startX; x < startX + VOXEL_SIZE; x++) {
                                        addVoxel(x, y, z);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break;
        }

        case 'haystack': {
            width = depth = shape.radius * 2;
            height = shape.height;
            const baseRadius = shape.radius;
            const center = baseRadius - 0.5;

            for (let y = 0; y < height; y++) {
                const progress = y / (height - 1);
                // Non-linear radius reduction for a more rounded shape
                const currentRadius = baseRadius * (1 - Math.pow(progress, 2.5));
                const currentRadiusSq = currentRadius * currentRadius;
                
                // Add some randomness to the center of each slice
                const offsetX = (Math.random() - 0.5) * (baseRadius / 8) * (1 - progress);
                const offsetZ = (Math.random() - 0.5) * (baseRadius / 8) * (1 - progress);
                
                for (let z = 0; z < baseRadius * 2; z++) {
                    for (let x = 0; x < baseRadius * 2; x++) {
                        const dx = x - center + offsetX;
                        const dz = z - center + offsetZ;
                        if (dx * dx + dz * dz <= currentRadiusSq) {
                            addVoxel(x, y, z);
                        }
                    }
                }
            }
            break;
        }

        case 'corner': {
            const { radius, height: cornerHeight, external, internal } = shape;
            width = depth = radius;
            height = cornerHeight;
            const rSq = radius * radius;

                 xyziValues = []; // Clear previous attempts
                 addVoxel(0,0,0,2); 

                 if (external) {
                    for (let y = 0; y < height; y++) {
                        for (let z = 0; z < radius; z++) {
                            for (let x = 0; x < radius; x++) {
                                if (x * x + z * z <= rSq) {
                                    addVoxel(x, y, z);
                                }
                            }
                        }
                    }
                 } else if (internal) {
                    // Create the full block first
                    for (let y = 0; y < height; y++) {
                        for (let z = 0; z < radius; z++) {
                            for (let x = 0; x < radius; x++) {
                                // Carve out the corner
                                if (x*x + z*z > rSq) {
                                    addVoxel(x,y,z);
                                }
                            }
                        }
                    }
                 }
            break;
        }

    }
    
    totalVoxels = xyziValues.length > 1 ? xyziValues.length -1 : 0;
    
    const palette: PaletteColor[] = Array.from({length: 256}, () => ({r:0,g:0,b:0,a:0}));
    palette[0] = { r: 0, g: 0, b: 0, a: 0 }; // MagicaVoxel palette is 1-indexed, so 0 is empty
    palette[1] = { r: 220, g: 220, b: 220, a: 255 }; 
    palette[2] = { r: 10, g: 10, b: 10, a: 255 };
    palette[3] = { r: 100, g: 100, b: 100, a: 255 };
    
    const voxSize = { x: width, y: depth, z: height };
    
    const voxObject = {
        size: voxSize,
        xyzi: {
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
        depth,
        pixels: [], // No 2D pixel preview for voxels
        isVox: true,
        voxData: buffer,
        voxSize: voxSize,
        totalVoxels,
    };
}

function grayscale(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}


    






    

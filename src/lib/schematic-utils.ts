import { writeVox } from './vox-writer';


export interface SchematicOutput {
  schematicData: string;
  width: number;
  height: number;
  pixels: boolean[];
  isVox?: boolean;
  voxData?: Uint8Array;
}

export type FontStyle = 'monospace' | 'serif' | 'sans-serif' | 'custom';
export type Shape = 'circle' | 'square' | 'triangle';
export type VoxShape = 'cuboid' | 'sphere' | 'pyramid';


// A simple helper to generate schematic data string
function createSchematicData(name: string, dimensions: {width: number, height: number, depth?: number}): string {
    const depthInfo = dimensions.depth ? `x${dimensions.depth}`: '';
    return `Schematic for: ${name} (${dimensions.width}x${dimensions.height}${depthInfo})`;
}

/**
 * Converts text to a pixel-based schematic.
 * This function uses the browser's Canvas API to rasterize text.
 */
export async function textToSchematic(text: string, font: FontStyle, fontSize: number, fontUrl?: string): Promise<SchematicOutput> {
    if (typeof document === 'undefined') {
        throw new Error('textToSchematic can only be run in a browser environment.');
    }

    let loadedFont = font as string;
    let fontFace: FontFace | undefined;
    if (fontUrl && font === 'custom') {
      fontFace = new FontFace('custom-font', `url(${fontUrl})`);
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
        loadedFont = 'custom-font';
      } catch (e) {
        console.error('Font loading failed:', e);
        // Fallback to a default font if loading fails
        loadedFont = 'monospace';
      }
    }


    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    ctx.font = `${fontSize}px ${loadedFont}`;
    const metrics = ctx.measureText(text);
    
    // Calculate dimensions
    const width = Math.ceil(metrics.width);
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const height = Math.ceil(ascent + descent);
    
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
    ctx.font = `${fontSize}px ${loadedFont}`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top'; // Use top to align with actualBoundingBoxAscent
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
    { type: 'square', width: number, height: number } |
    { type: 'triangle', side: number }
): SchematicOutput {
    let pixels: boolean[] = [];
    let width: number, height: number;

    switch (shape.type) {
        case 'square':
            width = shape.width;
            height = shape.height;
            pixels = new Array(width * height).fill(true);
            break;

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

        case 'triangle':
            width = shape.side;
            height = Math.ceil(Math.sqrt(3) / 2 * shape.side);
            for (let y = 0; y < height; y++) {
                const yPos = y / (height - 1); // Normalize y to 0-1
                const rowWidth = yPos * width;
                const rowOffset = (width - rowWidth) / 2;
                for (let x = 0; x < width; x++) {
                    pixels.push(x >= rowOffset && x < (rowOffset + rowWidth));
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
 * Converts an image from a data URI to a pixel-based schematic.
 * This function uses the browser's Canvas API.
 * This function is intended to be run in a Web Worker.
 */
export function imageToSchematic(dataUri: string, threshold: number): Promise<SchematicOutput> {
    return new Promise((resolve, reject) => {
        if (typeof self === 'undefined' || typeof self.createImageBitmap === 'undefined') {
             return reject(new Error('imageToSchematic can only be run in a browser or worker environment.'));
        }

        fetch(dataUri)
            .then(res => res.blob())
            .then(blob => self.createImageBitmap(blob))
            .then(img => {
                const canvas = new OffscreenCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const pixels: boolean[] = [];

                for (let i = 0; i < imageData.data.length; i += 4) {
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
                    pixels.push(grayscale < threshold);
                }

                resolve({
                    schematicData: createSchematicData('Imported Image', {width: img.width, height: img.height}),
                    width: img.width,
                    height: img.height,
                    pixels,
                });
            })
            .catch(err => {
                 reject(new Error(`Failed to load or process image: ${err}`));
            });
    });
}

/**
 * Generates a .vox file for a given 3D shape.
 */
export function voxToSchematic(shape: 
    { type: 'cuboid', width: number, height: number, depth: number } | 
    { type: 'sphere', radius: number } |
    { type: 'pyramid', base: number, height: number }
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
                const ratio = (height - 1 - y) / (height -1);
                const levelWidth = Math.max(1, Math.floor(width * ratio));
                const offset = Math.floor((width - levelWidth) / 2);
                for (let z = offset; z < offset + levelWidth; z++) {
                    for (let x = offset; x < offset + levelWidth; x++) {
                        addVoxel(x, y, z);
                    }
                }
            }
            break;
    }
    
    // The color is from our theme's primary variable.
    // In HSL, var(--primary) is 14 38% 35%. In RGB, this is 121, 79, 61.
    const palette = [
      { r: 121, g: 79, b: 61, a: 255 }
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

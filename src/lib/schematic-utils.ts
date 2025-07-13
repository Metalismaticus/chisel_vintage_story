
export interface SchematicOutput {
  schematicData: string;
  width: number;
  height: number;
  pixels: boolean[];
}

export type FontStyle = 'monospace' | 'serif' | 'sans-serif';
export type Shape = 'circle' | 'square' | 'triangle';

// A simple helper to generate schematic data string
function createSchematicData(name: string, dimensions: {width: number, height: number}): string {
    return `Schematic for: ${name} (${dimensions.width}x${dimensions.height})`;
}

/**
 * Converts text to a pixel-based schematic.
 * This function uses the browser's Canvas API to rasterize text.
 */
export async function textToSchematic(text: string, font: FontStyle, fontSize: number, fontUrl?: string): Promise<SchematicOutput> {
    if (typeof document === 'undefined') {
        throw new Error('textToSchematic can only be run in a browser environment.');
    }

    let loadedFont = font;
    if (fontUrl) {
      const fontFace = new FontFace('custom-font', `url(${fontUrl})`);
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
        loadedFont = 'custom-font';
      } catch (e) {
        console.error('Font loading failed:', e);
        // Fallback to the selected generic font
        loadedFont = font;
      }
    }


    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    ctx.font = `${fontSize}px ${loadedFont}`;
    const metrics = ctx.measureText(text);
    
    // Calculate dimensions
    const width = Math.ceil(metrics.width);
    const height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
    
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
    ctx.fillText(text, 0, metrics.actualBoundingBoxAscent);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels: boolean[] = [];

    for (let i = 0; i < imageData.data.length; i += 4) {
        // Check the alpha channel
        const alpha = imageData.data[i + 3];
        pixels.push(alpha > 128); // Pixel is "on" if it's not fully transparent
    }

    if (fontUrl && loadedFont === 'custom-font') {
        document.fonts.delete(document.fonts.get('custom-font')!);
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
        // This function is designed for browser environments, but might be called
        // in a worker where `Image` is available but not `document`.
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
                    // Simple grayscale conversion
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

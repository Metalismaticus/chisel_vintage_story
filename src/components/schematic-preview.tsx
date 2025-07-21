
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Package, Loader2, Info } from 'lucide-react';
import type { SchematicOutput } from '@/lib/schematic-utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface SchematicPreviewProps {
  schematicOutput?: SchematicOutput | null;
  loading: boolean;
}

const CHUNK_SIZE = 16;


export function SchematicPreview({ schematicOutput, loading }: SchematicPreviewProps) {
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);

  const finalSchematicData = schematicOutput?.schematicData;
  const isVox = schematicOutput?.isVox;
  const isScaled = schematicOutput && (schematicOutput.originalWidth || schematicOutput.originalHeight);


  const handleCopy = () => {
    if (finalSchematicData) {
      navigator.clipboard.writeText(finalSchematicData);
      toast({ title: 'Copied to clipboard!' });
    }
  };

  const handleDownload = async () => {
    if (!schematicOutput) {
      toast({ title: 'No data to download.', variant: 'destructive' });
      return;
    }
    
    if (isVox && schematicOutput.voxData) {
      const blob = new Blob([schematicOutput.voxData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schematic.vox';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    if (!gridRef.current) {
       toast({ title: 'Preview element not found.', variant: 'destructive' });
       return;
    }

    try {
        const { pixels, width, height, palette } = schematicOutput;
        if (!width || !height || !pixels) {
            toast({ title: 'No pixel data to download.', variant: 'destructive' });
            return;
        };

        const PIXEL_SCALE = 20;
        const GRID_COLOR = 'rgba(192, 164, 100, 0.2)';
        const CHUNK_BORDER_COLOR = 'rgba(200, 164, 100, 0.5)';

        const canvas = document.createElement('canvas');
        canvas.width = width * PIXEL_SCALE;
        canvas.height = height * PIXEL_SCALE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            toast({ title: 'Failed to create image context.', variant: 'destructive' });
            return;
        }

        ctx.fillStyle = '#2A3A4D';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelValue = pixels[y * width + x];
                if (typeof pixelValue === 'boolean' && pixelValue) { // B&W mode
                     ctx.fillStyle = '#F0F0F0';
                     ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
                } else if (typeof pixelValue === 'number' && pixelValue > 0 && palette) { // Color mode
                    const color = palette[pixelValue -1]; // colorIndex is 1-based
                    if (color) {
                        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
                        ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
                    }
                }
            }
        }

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        for (let i = 0; i <= width; i++) {
            ctx.beginPath();
            ctx.moveTo(i * PIXEL_SCALE, 0);
            ctx.lineTo(i * PIXEL_SCALE, height * PIXEL_SCALE);
            ctx.stroke();
        }
        for (let i = 0; i <= height; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * PIXEL_SCALE);
            ctx.lineTo(width * PIXEL_SCALE, i * PIXEL_SCALE);
            ctx.stroke();
        }

        ctx.strokeStyle = CHUNK_BORDER_COLOR;
        ctx.lineWidth = 2;
        for (let i = 0; i <= width; i += CHUNK_SIZE) {
            ctx.beginPath();
            ctx.moveTo(i * PIXEL_SCALE, 0);
            ctx.lineTo(i * PIXEL_SCALE, height * PIXEL_SCALE);
            ctx.stroke();
        }
        for (let i = 0; i <= height; i += CHUNK_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, i * PIXEL_SCALE);
            ctx.lineTo(width * PIXEL_SCALE, i * PIXEL_SCALE);
            ctx.stroke();
        }

        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'schematic.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                 toast({ title: 'Failed to create image blob.', variant: "destructive" });
            }
        }, 'image/png');

    } catch (error) {
        console.error("Download failed:", error);
        toast({ title: 'Download failed', description: 'An error occurred while creating the image file.', variant: "destructive" });
    }
  };

  const renderPixelGrid = () => {
    if (!schematicOutput || !schematicOutput.pixels || !schematicOutput.width || !schematicOutput.height) {
      return null;
    }

    const { pixels, width, height, palette } = schematicOutput;
    
    if (!Array.isArray(pixels) || pixels.length === 0 || !width || !height) {
       return null;
    }
    
    return Array.from({ length: height }).map((_, y) => (
      Array.from({ length: width }).map((_, x) => {
        const index = y * width + x;
        const pixelValue = pixels[index];
        const isTopBoundary = y > 0 && y % CHUNK_SIZE === 0;
        const isLeftBoundary = x > 0 && x % CHUNK_SIZE === 0;
        
        let backgroundColor = 'transparent';
        if (typeof pixelValue === 'boolean' && pixelValue) {
            backgroundColor = 'hsl(var(--foreground))';
        } else if (typeof pixelValue === 'number' && pixelValue > 0 && palette) {
            const color = palette[pixelValue -1]; // colorIndex is 1-based
            if (color) {
                backgroundColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
            }
        }


        return (
          <div
            key={`${y}-${x}`}
            className="w-full h-full border border-foreground/10"
            style={{
              backgroundColor: backgroundColor,
              boxShadow: `
                ${isLeftBoundary ? 'inset 1px 0 0 hsl(var(--primary) / 0.5)' : ''}
                ${isTopBoundary ? 'inset 0 1px 0 hsl(var(--primary) / 0.5)' : ''}
              `.trim().replace(/\s+/g, ' ') || 'none'
            }}
          ></div>
        );
      })
    )).flat();
  };
  
  const pixelGrid = renderPixelGrid();

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-semibold">Generating schematic...</p>
          <p className="text-sm text-muted-foreground">Please wait, this may take a moment for large images.</p>
        </div>
      );
    }

    if (!finalSchematicData) {
      return (
        <div className="flex items-center justify-center h-full border-2 border-dashed border-input rounded-lg">
          <p className="text-muted-foreground">Awaiting generation...</p>
        </div>
      );
    }
    
    if (isVox) {
        return (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-input rounded-lg p-8 text-center">
              <Package className="w-16 h-16 text-primary mb-4" />
              <h3 className="text-xl font-semibold uppercase tracking-wider">VOX file generated</h3>
              <p className="text-muted-foreground mt-2">
                A 3D .vox file has been created. Use the button below to save it. 3D preview is not available.
              </p>
            </div>
        );
    }

    return (
      <div className="space-y-4">
        {isScaled && (
            <Alert variant="default" className="border-primary/30 bg-primary/10">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle>Preview Scaled</AlertTitle>
                <AlertDescription>
                    Original image ({schematicOutput.originalWidth}x{schematicOutput.originalHeight}) was scaled down for preview. The exported schematic will use the full resolution.
                </AlertDescription>
            </Alert>
        )}
        {pixelGrid && schematicOutput && schematicOutput.width > 0 && schematicOutput.height > 0 ? (
           <div ref={gridRef} className="w-full overflow-auto border rounded-lg p-1 bg-black/20 flex justify-center items-center" style={{maxHeight: '400px'}}>
            <div
              className="grid"
              style={{ 
                width: `${schematicOutput.width * 1}rem`,
                maxWidth: '100%',
                gridTemplateColumns: `repeat(${schematicOutput.width}, minmax(0, 1fr))`,
                aspectRatio: `${schematicOutput.width} / ${schematicOutput.height}`,
                backgroundImage: 'linear-gradient(rgba(240, 240, 240, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(240, 240, 240, 0.1) 1px, transparent 1px)',
                backgroundSize: '1rem 1rem',
              }}
            >
              {pixelGrid}
            </div>
          </div>
        ) : (
           <div className="border rounded-lg p-2 bg-black/20 aspect-square overflow-hidden flex items-center justify-center">
            <p className="text-muted-foreground text-sm text-center">Preview is not available for this schematic type, but you can copy or download the data below.</p>
          </div>
        )}
        <Textarea readOnly value={finalSchematicData} className="h-24 font-mono text-xs bg-black/20 border-input" />
      </div>
    );
  };

  return (
    <Card className="flex flex-col bg-card/70 border-primary/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-headline uppercase tracking-wider">Schematic Preview</CardTitle>
        <CardDescription>Your generated schematic will appear here.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 min-h-[300px]">
        {renderContent()}
      </CardContent>
      {finalSchematicData && !loading && (
        <CardFooter className="flex gap-2 pt-4">
          {!isVox && (
             <Button onClick={handleCopy} variant="outline" className="w-full uppercase font-bold tracking-wider">
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          )}
          <Button onClick={handleDownload} className="w-full uppercase font-bold tracking-wider">
            <Download className="mr-2 h-4 w-4" /> Download {isVox ? '.vox' : '.png'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

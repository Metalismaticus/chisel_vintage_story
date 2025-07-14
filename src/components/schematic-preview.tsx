
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, Package } from 'lucide-react';
import type { SchematicOutput } from '@/lib/schematic-utils';

interface SchematicPreviewProps {
  schematicOutput?: SchematicOutput | null;
  loading: boolean;
}

const CHUNK_SIZE = 16;
const PIXEL_SCALE = 20;
const GRID_COLOR = 'rgba(0, 255, 0, 0.5)';
const CHUNK_BORDER_COLOR = 'rgba(255, 0, 0, 0.7)';


export function SchematicPreview({ schematicOutput, loading }: SchematicPreviewProps) {
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);

  const finalSchematicData = schematicOutput?.schematicData;
  const isVox = schematicOutput?.isVox;

  const handleCopy = () => {
    if (finalSchematicData) {
      navigator.clipboard.writeText(finalSchematicData);
      toast({ title: 'Copied to clipboard!' });
    }
  };

  const handleDownload = async () => {
    if (!schematicOutput) {
      toast({ title: "No data to download.", variant: 'destructive' });
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

    if (!schematicOutput.pixels) {
       toast({ title: "No schematic data to download.", variant: 'destructive' });
       return;
    }
    
    const { pixels, width, height } = schematicOutput;

    if (!width || !height || !pixels) return;

    const canvas = document.createElement('canvas');
    canvas.width = width * PIXEL_SCALE;
    canvas.height = height * PIXEL_SCALE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      toast({ title: "Failed to create image.", variant: 'destructive' });
      return;
    }

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw pixels
    ctx.fillStyle = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()})`;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[y * width + x]) {
          ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
        }
      }
    }
    
    // Draw grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * PIXEL_SCALE, 0);
      ctx.lineTo(x * PIXEL_SCALE, height * PIXEL_SCALE);
      ctx.stroke();
    }
     for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * PIXEL_SCALE);
      ctx.lineTo(width * PIXEL_SCALE, y * PIXEL_SCALE);
      ctx.stroke();
    }

    // Draw chunk borders
    ctx.strokeStyle = CHUNK_BORDER_COLOR;
    ctx.lineWidth = 2;
     for (let x = 0; x <= width; x += CHUNK_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x * PIXEL_SCALE, 0);
      ctx.lineTo(x * PIXEL_SCALE, height * PIXEL_SCALE);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += CHUNK_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y * PIXEL_SCALE);
      ctx.lineTo(width * PIXEL_SCALE, y * PIXEL_SCALE);
      ctx.stroke();
    }


    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schematic.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPixelGrid = () => {
    if (!schematicOutput || !schematicOutput.pixels || !schematicOutput.width || !schematicOutput.height) {
      return null;
    }

    const { pixels, width, height } = schematicOutput;
    
    if (!Array.isArray(pixels) || pixels.length === 0 || !width || !height) {
       return null;
    }
    
    const normalizedPixels = Array.from({ length: width * height }, (_, i) => pixels[i] ?? false);

    return Array.from({ length: height }).map((_, y) => (
      Array.from({ length: width }).map((_, x) => {
        const index = y * width + x;
        const isFilled = normalizedPixels[index];
        const isTopBoundary = y > 0 && y % CHUNK_SIZE === 0;
        const isLeftBoundary = x > 0 && x % CHUNK_SIZE === 0;

        return (
          <div
            key={`${y}-${x}`}
            className="w-full h-full border border-foreground/10"
            style={{
              backgroundColor: isFilled ? 'hsl(var(--primary))' : 'hsl(var(--background))',
              boxShadow: `
                ${isLeftBoundary ? 'inset 1px 0 0 hsl(var(--destructive) / 0.7)' : ''}
                ${isTopBoundary ? 'inset 0 1px 0 hsl(var(--destructive) / 0.7)' : ''}
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
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      );
    }

    if (!finalSchematicData) {
      return (
        <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Awaiting generation...</p>
        </div>
      );
    }
    
    if (isVox) {
        return (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg p-8 text-center">
              <Package className="w-16 h-16 text-primary mb-4" />
              <h3 className="text-xl font-semibold">VOX File Generated</h3>
              <p className="text-muted-foreground mt-2">
                A 3D .vox file has been created. Use the download button below to save it. 
                3D preview is not available.
              </p>
            </div>
        );
    }

    return (
      <div className="space-y-4">
        {pixelGrid && schematicOutput && schematicOutput.width > 0 && schematicOutput.height > 0 ? (
           <div ref={gridRef} className="w-full overflow-auto border rounded-lg p-1 bg-background/50 aspect-square">
            <div
              className="w-full h-full"
              style={{ 
                display: 'grid',
                gridTemplateColumns: `repeat(${schematicOutput.width}, 1fr)`,
                gridTemplateRows: `repeat(${schematicOutput.height}, 1fr)`,
                aspectRatio: `${schematicOutput.width} / ${schematicOutput.height}`
              }}
            >
              {pixelGrid}
            </div>
          </div>
        ) : (
           <div className="border rounded-lg p-2 bg-background/50 aspect-square overflow-hidden flex items-center justify-center">
            <p className="text-muted-foreground text-sm text-center">Preview not available for this schematic type, but you can copy or download the data below.</p>
          </div>
        )}
        <Textarea readOnly value={finalSchematicData} className="h-24 font-code text-xs" />
      </div>
    );
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Schematic Preview</CardTitle>
        <CardDescription>Your generated schematic will appear here.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {renderContent()}
      </CardContent>
      {finalSchematicData && !loading && (
        <CardFooter className="flex gap-2 pt-4">
          {!isVox && (
             <Button onClick={handleCopy} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          )}
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Download {isVox ? '.vox' : '.png'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

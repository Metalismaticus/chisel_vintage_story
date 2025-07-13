'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download } from 'lucide-react';
import type { TextToSchematicOutput } from '@/ai/flows/text-to-schematic';

interface SchematicPreviewProps {
  schematicData?: string | null; // For simple schematic strings
  schematicOutput?: TextToSchematicOutput | null; // For detailed schematic objects
  loading: boolean;
}

const CHUNK_SIZE = 16;

export function SchematicPreview({ schematicData, schematicOutput, loading }: SchematicPreviewProps) {
  const { toast } = useToast();

  const finalSchematicData = schematicOutput?.schematicData ?? schematicData;

  const handleCopy = () => {
    if (finalSchematicData) {
      navigator.clipboard.writeText(finalSchematicData);
      toast({ title: 'Copied to clipboard!' });
    }
  };

  const handleDownload = () => {
    if (finalSchematicData) {
      const blob = new Blob([finalSchematicData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schematic.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const renderPixelGrid = () => {
    if (!schematicOutput || !schematicOutput.pixels || !schematicOutput.width || !schematicOutput.height) {
      return null;
    }

    const { pixels, width, height } = schematicOutput;

    return Array.from({ length: height }).map((_, y) => (
      Array.from({ length: width }).map((_, x) => {
        const index = y * width + x;
        const isFilled = pixels[index];
        const isTopBoundary = y % CHUNK_SIZE === 0 && y > 0;
        const isLeftBoundary = x % CHUNK_SIZE === 0 && x > 0;

        return (
          <div
            key={`${y}-${x}`}
            className="w-full h-full"
            style={{
              backgroundColor: isFilled ? 'hsl(var(--primary))' : 'hsl(var(--accent) / 20%)',
              boxShadow: `
                ${isLeftBoundary ? 'inset 1px 0 0 hsl(var(--destructive))' : ''}
                ${isTopBoundary ? 'inset 0 1px 0 hsl(var(--destructive))' : ''}
              `
            }}
          ></div>
        );
      })
    )).flat();
  };
  
  const pixelGrid = renderPixelGrid();

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Schematic Preview</CardTitle>
        <CardDescription>Your generated schematic will appear here.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : finalSchematicData ? (
          <div className="space-y-4">
            {pixelGrid && schematicOutput ? (
               <div className="w-full overflow-auto border rounded-lg p-1 bg-background/50 aspect-square">
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
              <div className="border rounded-lg p-2 bg-background/50 aspect-square overflow-hidden">
                <p className="text-muted-foreground text-sm">Preview not available for this schematic type.</p>
              </div>
            )}
            <Textarea readOnly value={finalSchematicData} className="h-24 font-code text-xs" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Awaiting generation...</p>
          </div>
        )}
      </CardContent>
      {finalSchematicData && !loading && (
        <CardFooter className="flex gap-2 pt-4">
          <Button onClick={handleCopy} variant="outline" className="w-full">
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

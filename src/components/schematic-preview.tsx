'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download } from 'lucide-react';

interface SchematicPreviewProps {
  schematicData: string | null;
  loading: boolean;
}

const GRID_DIMENSION = 16;

export function SchematicPreview({ schematicData, loading }: SchematicPreviewProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    if (schematicData) {
      navigator.clipboard.writeText(schematicData);
      toast({ title: 'Copied to clipboard!' });
    }
  };

  const handleDownload = () => {
    if (schematicData) {
      const blob = new Blob([schematicData], { type: 'text/plain' });
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
    // Mock visual representation
    return Array.from({ length: GRID_DIMENSION * GRID_DIMENSION }).map((_, i) => {
      const row = Math.floor(i / GRID_DIMENSION);
      const col = i % GRID_DIMENSION;
      const isPrimary = (row + col) % 2 === 0;
      return (
        <div
          key={i}
          className="w-full h-full"
          style={{ backgroundColor: isPrimary ? 'hsl(var(--primary))' : 'hsl(var(--accent))' }}
        ></div>
      );
    });
  };

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
        ) : schematicData ? (
          <div className="space-y-4">
            <div 
              className="border rounded-lg p-2 bg-background/50 aspect-square overflow-hidden"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_DIMENSION}, 1fr)`, gridTemplateRows: `repeat(${GRID_DIMENSION}, 1fr)`, gap: '1px' }}
            >
              {renderPixelGrid()}
            </div>
            <Textarea readOnly value={schematicData} className="h-24 font-code text-xs" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Awaiting generation...</p>
          </div>
        )}
      </CardContent>
      {schematicData && !loading && (
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

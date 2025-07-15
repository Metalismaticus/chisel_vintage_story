
'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { SchematicPreview } from './schematic-preview';
import { UploadCloud } from 'lucide-react';
import type { SchematicOutput } from '@/lib/schematic-utils';
import { Slider } from '@/components/ui/slider';


export function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [schematic, setSchematic] = useState<SchematicOutput | null>(null);
  const [threshold, setThreshold] = useState([128]);
  const [isPending, setIsPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker>();
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/image.worker.ts', import.meta.url));
    
    workerRef.current.onmessage = (event: MessageEvent<SchematicOutput | { error: string }>) => {
      if ('error' in event.data) {
        console.error('Worker error:', event.data.error);
        toast({
          title: "Conversion failed",
          description: event.data.error,
          variant: "destructive",
        });
        setSchematic(null);
      } else {
        setSchematic(event.data);
      }
      setIsPending(false);
    };
    
    workerRef.current.onerror = (error) => {
       console.error('Worker onerror:', error);
       toast({
         title: "Conversion failed",
         description: "An unexpected error occurred in the conversion worker. Check the console for details.",
         variant: "destructive",
       });
       setSchematic(null);
       setIsPending(false);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, [toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSchematic(null);
      
      if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
      }
      
      const newPreviewUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(newPreviewUrl);
    }
  };

  const handleConvert = () => {
    if (!file) {
      toast({
        title: "No image selected",
        description: "Please select an image file to convert.",
        variant: "destructive",
      });
      return;
    }
    
    // 1. Set loading state immediately.
    setSchematic(null);
    setIsPending(true);
    
    // 2. Use setTimeout to allow React to re-render and show the loader
    //    BEFORE we post the message to the worker. This is the key fix.
    setTimeout(() => {
        workerRef.current?.postMessage({ file, threshold: threshold[0] });
    }, 0);
  };
  
  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    }
  }, [previewUrl]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-card/70 border-primary/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline uppercase tracking-wider">Image to Pixel Art</CardTitle>
          <CardDescription>Convert any image into a Vintage Story schematic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="image-upload">Upload Image</Label>
            <div 
              className="mt-2 flex justify-center rounded-lg border border-dashed border-input px-6 py-10 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Image preview"
                    width={200}
                    height={200}
                    className="mx-auto h-32 w-auto rounded-md object-contain"
                  />
                ) : (
                  <>
                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                      <p className="pl-1">Click to upload or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
                <Input
                  ref={fileInputRef}
                  id="image-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/gif"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold">Black & White Threshold: {threshold[0]}</Label>
            <Slider
              id="threshold"
              min={0}
              max={255}
              step={1}
              value={threshold}
              onValueChange={setThreshold}
            />
          </div>
          <Button onClick={handleConvert} disabled={isPending || !file} className="w-full uppercase font-bold tracking-wider">
            {isPending ? 'Converting...' : 'Convert to Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematic} loading={isPending} />
    </div>
  );
}

'use client';

import { useState, useRef, useTransition } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { SchematicPreview } from './schematic-preview';
import { UploadCloud } from 'lucide-react';
import type { SchematicOutput } from '@/lib/schematic-utils';
import { imageToSchematic } from '@/lib/schematic-utils';
import { Slider } from '@/components/ui/slider';


export function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [schematic, setSchematic] = useState<SchematicOutput | null>(null);
  const [threshold, setThreshold] = useState([128]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setSchematic(null);
    }
  };

  const handleConvert = async () => {
    if (!file || !previewUrl) {
      toast({
        title: "No image selected",
        description: "Please select an image file to convert.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await imageToSchematic(previewUrl, threshold[0]);
        setSchematic(result);
      } catch (error) {
        console.error(error);
        toast({
          title: "Conversion failed",
          description: "An error occurred while converting the image. Please try again.",
          variant: "destructive",
        });
        setSchematic(null);
      }
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Image to Pixel Art</CardTitle>
          <CardDescription>Convert any image into a Vintage Story schematic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="image-upload">Upload Image</Label>
            <div 
              className="mt-2 flex justify-center rounded-lg border border-dashed border-input px-6 py-10 cursor-pointer hover:border-primary/50 transition-colors"
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
          <Button onClick={handleConvert} disabled={isPending || !file} className="w-full">
            {isPending ? 'Converting...' : 'Convert to Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematic} loading={isPending} />
    </div>
  );
}

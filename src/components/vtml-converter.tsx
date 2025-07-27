'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Loader2, RefreshCw, X, Copy } from 'lucide-react';
import { VtmlRenderer } from './vtml-renderer';
import { useI18n } from '@/locales/client';
import { cn } from '@/lib/utils';

// Game-tested palette
const CHAR_COLOR_MAP: { [key: string]: string } = {
  '█': '#D7D6C0', '▓': '#B2B1B9', '▒': '#8F888F', '░': '#736A5F',
  'Σ': '#9C7063', 'Ω': '#B1877E', 'ƒ': '#7B5446', '®': '#796F42',
  'Ò': '#7D7354', '»': '#918A5D', 'χ': '#586248', 'τ': '#526B3E',
  'ó': '#678063', '¥': '#8C869F', 'σ': '#8D879E', '♥': '#C7A5BE',
  'Ẅ': '#AF87A0', '≥': '#5B464E', '•': '#62574A', 'ю': '#9DBDB4',
  'ζ': '#606C6E', 'È': '#82636D', '◊': '#62575A', '┐': '#55494B',
  '┴': '#766D7C',
};

// --- Helper Functions ---
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const colorDistance = (c1: [number, number, number], c2: [number, number, number]): number => {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

// Cache palette for quick access
const PALETTE_CHARS = Object.keys(CHAR_COLOR_MAP);
const PALETTE_RGB = PALETTE_CHARS.map(char => hexToRgb(CHAR_COLOR_MAP[char]));
const BW_CHARS = [' ', '░', '▒', '▓', '█'];

const getClosestChar = (r: number, g: number, b: number): string => {
  let minDistance = Infinity;
  let closestChar = ' ';
  for (let i = 0; i < PALETTE_RGB.length; i++) {
    const distance = colorDistance([r, g, b], PALETTE_RGB[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestChar = PALETTE_CHARS[i];
    }
  }
  return closestChar;
};

const generateVtml = (
  img: HTMLImageElement,
  maxLineLength: number,
  fontSize: number,
  isColor: boolean
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return resolve('');

    const aspectRatio = img.height / img.width;
    const charAspectRatio = 2; // Approximation for monospace characters
    const width = maxLineLength;
    const height = Math.round(width * aspectRatio / charAspectRatio);

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;

    let finalLines: string[] = [];
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 128) {
            line += ' ';
            continue;
        }
        if (isColor) {
          line += getClosestChar(r, g, b);
        } else {
          const gray = (r * 0.299 + g * 0.587 + b * 0.114);
          const charIndex = Math.round((gray / 255) * (BW_CHARS.length - 1));
          line += BW_CHARS[charIndex];
        }
      }
      finalLines.push(line);
    }
    
    const content = finalLines.join('<br>');
    const vtmlString = `<font size="${fontSize}" family="Lucida Console" align="center">${content}</font>`;
    resolve(vtmlString);
  });
};

export function VtmlConverter() {
  const t = useI18n();
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(1);
  const [maxLineLength, setMaxLineLength] = useState(80);
  const [isColor, setIsColor] = useState(false);
  const [vtmlCode, setVtmlCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: t('vtmlConverter.errors.invalidFileType'),
          description: t('vtmlConverter.errors.invalidFileTypeDesc'),
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUri(reader.result as string);
        setVtmlCode('');
        setIsDirty(true);
      };
      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: t('vtmlConverter.errors.fileReadError'),
          description: t('vtmlConverter.errors.fileReadErrorDesc'),
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleGenerateClick = useCallback(async () => {
    if (!photoDataUri || !imageRef.current || !imageRef.current.complete || imageRef.current.naturalHeight === 0) {
      toast({
        title: t('vtmlConverter.errors.imageNotReady'),
        description: t('vtmlConverter.errors.imageNotReadyDesc'),
      });
      return;
    }
    setIsGenerating(true);
    try {
      const code = await generateVtml(imageRef.current, maxLineLength, fontSize, isColor);
      setVtmlCode(code);
      setIsDirty(false); 
    } catch (error) {
      console.error("Image to VTML conversion error:", error);
      toast({
        variant: "destructive",
        title: t('common.errors.generationFailed'),
        description: (error instanceof Error) ? error.message : t('common.errors.genericError'),
      });
    } finally {
      setIsGenerating(false);
    }
  }, [photoDataUri, maxLineLength, fontSize, isColor, toast, t]);
  
  const handleSettingsChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (value: any) => {
    setter(value);
    setIsDirty(true);
  };

  const handleSliderChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (value: number[]) => {
      setter(value[0]);
      setIsDirty(true);
  };

  const handleDownload = () => {
    if (!vtmlCode) {
      toast({
        variant: "destructive",
        title: t('vtmlConverter.errors.nothingToDownload'),
        description: t('vtmlConverter.errors.nothingToDownloadDesc'),
      });
      return;
    }
    const blob = new Blob([vtmlCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'art.vtml.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
   const handleCopy = () => {
    if (!vtmlCode) {
      toast({
        variant: 'destructive',
        title: t('vtmlConverter.errors.nothingToCopy'),
        description: t('vtmlConverter.errors.nothingToCopyDesc'),
      });
      return;
    }
    navigator.clipboard.writeText(vtmlCode);
    toast({
      title: t('schematicPreview.copied'),
    });
  };
  
   const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
     if (fileInputRef.current) {
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            fileInputRef.current.files = files;
            const changeEvent = new Event('change', { bubbles: true });
            fileInputRef.current.dispatchEvent(changeEvent);
        }
      }
  };

  const isLoading = isGenerating;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {photoDataUri && <img ref={imageRef} src={photoDataUri} alt="Hidden source for canvas" className="hidden" />}
      
      <div className="space-y-6">
        <Card className="bg-card/70 border-primary/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{t('vtmlConverter.step1.title')}</CardTitle>
            <CardDescription>{t('vtmlConverter.step1.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/png, image/jpeg, image/gif"
              id="file-upload"
            />
            {photoDataUri ? (
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border-2 border-dashed border-primary">
                <Image src={photoDataUri} alt={t('imageConverter.previewAlt')} layout="fill" objectFit="contain" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => { setPhotoDataUri(null); setVtmlCode(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
                <label 
                    className={cn(
                        "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card/50 hover:bg-muted/50 transition-colors",
                        isDragging && "border-primary bg-primary/10"
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    htmlFor="file-upload"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-primary">{t('vtmlConverter.step1.clickToUpload')}</span> {t('vtmlConverter.step1.orDragAndDrop')}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('vtmlConverter.step1.fileTypes')}</p>
                    </div>
                </label>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-primary/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{t('vtmlConverter.step2.title')}</CardTitle>
            <CardDescription>{t('vtmlConverter.step2.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="flex items-center space-x-2">
                <Switch id="color-mode" checked={isColor} onCheckedChange={handleSettingsChange(setIsColor)} disabled={isLoading} />
                <Label htmlFor="color-mode">{t('vtmlConverter.step2.colorMode')}</Label>
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="font-size">{t('vtmlConverter.step2.fontSize')}</Label>
                <span className="text-sm font-mono px-2 py-1 rounded-md bg-muted">{fontSize}</span>
              </div>
              <Slider id="font-size" min={1} max={24} step={1} value={[fontSize]} onValueChange={handleSliderChange(setFontSize)} disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="line-length">{t('vtmlConverter.step2.maxLineLength')}</Label>
                <span className="text-sm font-mono px-2 py-1 rounded-md bg-muted">{maxLineLength}</span>
              </div>
              <Slider id="line-length" min={20} max={400} step={1} value={[maxLineLength]} onValueChange={handleSliderChange(setMaxLineLength)} disabled={isLoading} />
            </div>
             <Button onClick={handleGenerateClick} disabled={isLoading || !isDirty || !photoDataUri} className="w-full uppercase font-bold tracking-wider">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isDirty ? t('vtmlConverter.step2.button') : t('vtmlConverter.step2.buttonUpToDate')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/70 border-primary/20 backdrop-blur-sm h-full min-h-[500px] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('vtmlConverter.step3.title')}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!vtmlCode || isLoading}>
                <Copy className="mr-2 h-4 w-4" />
                {t('common.copy')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!vtmlCode || isLoading}>
                <Download className="mr-2 h-4 w-4" />
                {t('common.download')}
              </Button>
            </div>
          </div>
           <CardDescription>{t('vtmlConverter.step3.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4">
            <div className="flex-1 border rounded-md bg-black/50 p-2 overflow-auto relative">
              {isLoading && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
              )}
              <VtmlRenderer code={vtmlCode} />
            </div>
            <Textarea
              readOnly
              placeholder={isLoading ? t('common.generating') : t('vtmlConverter.step3.placeholder')}
              value={vtmlCode}
              className="flex-1 w-full font-mono text-xs bg-black/20 resize-none"
            />
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { SchematicPreview } from './schematic-preview';
import { UploadCloud, Loader2 } from 'lucide-react';
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
    // Инициализируем Worker при монтировании компонента
    workerRef.current = new Worker(new URL('../lib/image.worker.ts', import.meta.url));
    
    // Обработчик сообщений от Worker'а
    workerRef.current.onmessage = (event: MessageEvent<SchematicOutput | { error: string }>) => {
      if ('error' in event.data) {
        console.error('Worker error:', event.data.error);
        toast({
          title: "Ошибка конвертации",
          description: event.data.error,
          variant: "destructive",
        });
        setSchematic(null);
      } else {
        setSchematic(event.data);
      }
      setIsPending(false); // Снимаем флаг загрузки
    };
    
    // Обработчик ошибок самого Worker'а
    workerRef.current.onerror = (error) => {
       console.error('Worker onerror:', error);
       toast({
         title: "Ошибка конвертации",
         description: "Произошла непредвиденная ошибка в фоновом процессе. Проверьте консоль для деталей.",
         variant: "destructive",
       });
       setSchematic(null);
       setIsPending(false);
    }

    // Очистка при размонтировании компонента
    return () => {
      workerRef.current?.terminate();
    };
  }, [toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSchematic(null);
      
      // Освобождаем старый URL, если он был
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
        title: "Изображение не выбрано",
        description: "Пожалуйста, выберите файл для конвертации.",
        variant: "destructive",
      });
      return;
    }
    
    setSchematic(null);
    setIsPending(true); // Устанавливаем флаг загрузки
    
    // Отправляем сообщение в Worker. Вся тяжелая работа будет там.
    workerRef.current?.postMessage({ file, threshold: threshold[0] });
  };
  
  // Очищаем object URL при размонтировании
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
            <Label htmlFor="image-upload">Загрузить изображение</Label>
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
                      <p className="pl-1">Нажмите для загрузки или перетащите файл</p>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">PNG, JPG, GIF до 10MB</p>
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
            <Label htmlFor="threshold">Порог чёрно-белого: {threshold[0]}</Label>
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
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Конвертация...
              </>
            ) : (
              'Конвертировать в схему'
            )}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematic} loading={isPending} />
    </div>
  );
}

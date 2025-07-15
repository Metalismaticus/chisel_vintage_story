
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { SchematicPreview } from './schematic-preview';
import { useToast } from '@/hooks/use-toast';
import { textToSchematic, type SchematicOutput, type FontStyle } from '@/lib/schematic-utils';
import { Upload } from 'lucide-react';
import { useI18n } from '@/locales/client';

export function TextConstructor() {
  const [text, setText] = useState('Vintage');
  const [fontSize, setFontSize] = useState([24]);
  const [font, setFont] = useState<FontStyle>('monospace');
  const [fontFile, setFontFile] = useState<File | null>(null);
  const fontFileUrlRef = useRef<string | null>(null);
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useI18n();
  
  useEffect(() => {
    return () => {
      if (fontFileUrlRef.current) {
        URL.revokeObjectURL(fontFileUrlRef.current);
      }
    };
  }, []);

  const handleFontFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (fontFileUrlRef.current) {
        URL.revokeObjectURL(fontFileUrlRef.current);
      }
      setFontFile(file);
      const url = URL.createObjectURL(file);
      fontFileUrlRef.current = url;
      setFont('custom'); 
    }
  };


  const handleGenerate = () => {
    if (!text) {
      toast({
        title: t('toast.error.noTextTitle'),
        description: t('toast.error.noTextDescription'),
        variant: "destructive",
      });
      return;
    }

    setSchematicOutput(null);
    startTransition(async () => {
      try {
        const result = await textToSchematic(text, font, fontSize[0], fontFileUrlRef.current ?? undefined);
        setSchematicOutput(result);
      } catch (error) {
        console.error(error);
        toast({
          title: t('toast.error.generationFailedTitle'),
          description: t('toast.error.generationFailedDescription'),
          variant: "destructive",
        });
        setSchematicOutput(null);
      }
    });
  };

  const handleFontChange = (value: FontStyle) => {
    setFont(value);
    if (value !== 'custom') {
      setFontFile(null);
      if (fontFileUrlRef.current) {
        URL.revokeObjectURL(fontFileUrlRef.current);
        fontFileUrlRef.current = null;
      }
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-card/70 border-primary/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline uppercase tracking-wider">{t('text.title')}</CardTitle>
          <CardDescription>{t('text.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="text-input">{t('text.textLabel')}</Label>
            <Input id="text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('text.textPlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('text.fontFamilyLabel')}</Label>
            <Select 
              value={font} 
              onValueChange={(v) => handleFontChange(v as FontStyle)}>
              <SelectTrigger>
                <SelectValue placeholder={t('text.fontFamilyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monospace">Monospace</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="sans-serif">Sans-Serif</SelectItem>
                 {fontFile && <SelectItem value="custom" disabled>{fontFile.name}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-upload">{t('text.uploadFontLabel')}</Label>
            <Button asChild variant="outline" className="w-full">
              <label className="cursor-pointer flex items-center justify-center">
                <Upload className="mr-2 h-4 w-4" />
                {fontFile ? fontFile.name : t('text.chooseFontButton')}
                <input id="font-upload" type="file" className="sr-only" onChange={handleFontFileChange} accept=".ttf,.otf,.woff,.woff2" />
              </label>
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-size">{t('text.fontSizeLabel')}: {fontSize[0]}px</Label>
            <Slider
              id="font-size"
              min={8}
              max={128}
              step={1}
              value={fontSize}
              onValueChange={setFontSize}
            />
          </div>
          <Button onClick={handleGenerate} disabled={isPending} className="w-full uppercase font-bold tracking-wider">
            {isPending ? t('buttons.generating') : t('buttons.generateSchematic')}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

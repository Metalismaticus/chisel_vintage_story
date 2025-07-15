'use client';

import { useState, useTransition } from 'react';
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

export function TextConstructor() {
  const [text, setText] = useState('Vintage');
  const [fontSize, setFontSize] = useState([24]);
  const [font, setFont] = useState<FontStyle>('monospace');
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontFileUrl, setFontFileUrl] = useState<string | null>(null);
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const handleFontFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'font/ttf' && file.type !== 'font/otf' && file.type !== 'application/font-woff' && file.type !== 'font/woff' && file.type !== 'font/woff2') {
        toast({
            title: "Invalid font file",
            description: "Please upload a valid .ttf, .otf or .woff file.",
            variant: "destructive",
        });
        return;
      }
      setFontFile(file);
      const url = URL.createObjectURL(file);
      setFontFileUrl(url);
      setFont('custom'); // Set to custom to indicate a file is selected
    }
  };


  const handleGenerate = () => {
    if (!text) {
      toast({
        title: "Text is empty",
        description: "Please enter some text to generate a schematic.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await textToSchematic(text, font, fontSize[0], fontFileUrl ?? undefined);
        setSchematicOutput(result);
      } catch (error) {
        console.error(error);
        toast({
          title: "Generation failed",
          description: "An error occurred while generating the schematic. Please try again.",
          variant: "destructive",
        });
        setSchematicOutput(null);
      }
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Text Constructor</CardTitle>
          <CardDescription>Create pixel art text for your world.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="text-input">Text</Label>
            <Input id="text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter your text" />
          </div>
          <div className="space-y-2">
            <Label>Font Family</Label>
            <Select 
              value={font} 
              onValueChange={(v) => {
                const newFont = v as FontStyle;
                setFont(newFont);
                if (newFont !== 'custom') {
                  setFontFile(null);
                  if (fontFileUrl) {
                    URL.revokeObjectURL(fontFileUrl);
                    setFontFileUrl(null);
                  }
                }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a font" />
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
            <Label htmlFor="font-upload">Upload Custom Font (.ttf, .otf, .woff)</Label>
            <Button asChild variant="outline" className="w-full">
              <label className="cursor-pointer flex items-center justify-center">
                <Upload className="mr-2 h-4 w-4" />
                {fontFile ? fontFile.name : 'Choose Font'}
                <input id="font-upload" type="file" className="sr-only" onChange={handleFontFileChange} accept=".ttf,.otf,.woff,.woff2" />
              </label>
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size: {fontSize[0]}px</Label>
            <Slider
              id="font-size"
              min={8}
              max={128}
              step={1}
              value={fontSize}
              onValueChange={setFontSize}
            />
          </div>
          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? 'Generating...' : 'Generate Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

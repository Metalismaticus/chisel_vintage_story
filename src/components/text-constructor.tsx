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

export function TextConstructor() {
  const [text, setText] = useState('Vintage');
  const [fontSize, setFontSize] = useState([24]);
  const [font, setFont] = useState<FontStyle>('monospace');
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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
        const result = textToSchematic(text, font, fontSize[0]);
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
            <Select value={font} onValueChange={(v) => setFont(v as FontStyle)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a font" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monospace">Monospace</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="sans-serif">Sans-Serif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size: {fontSize[0]}px</Label>
            <Slider
              id="font-size"
              min={8}
              max={64}
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

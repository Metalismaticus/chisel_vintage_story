'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SchematicPreview } from './schematic-preview';
import { useToast } from '@/hooks/use-toast';
import { shapeToSchematic, type Shape, type SchematicOutput } from '@/lib/schematic-utils';


export function ShapeGenerator() {
  const [shape, setShape] = useState<Shape>('circle');
  const [dimensions, setDimensions] = useState({ radius: '16', width: '16', side: '16' });
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDimensionChange = (field: keyof typeof dimensions, value: string) => {
    setDimensions(prev => ({...prev, [field]: value}));
  };

  const handleGenerate = () => {
    startTransition(() => {
      try {
        let result: SchematicOutput;
        const parsedRadius = parseInt(dimensions.radius, 10);
        const parsedWidth = parseInt(dimensions.width, 10);
        const parsedSide = parseInt(dimensions.side, 10);

        switch(shape) {
          case 'circle':
            if (isNaN(parsedRadius) || parsedRadius <= 0) {
              toast({ title: "Invalid radius", description: "Please enter a positive number for the radius.", variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'circle', radius: parsedRadius });
            break;
          case 'square':
            if (isNaN(parsedWidth) || parsedWidth <= 0) {
              toast({ title: "Invalid width", description: "Please enter a positive number for the width.", variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'square', width: parsedWidth, height: parsedWidth });
            break;
          case 'triangle':
             if (isNaN(parsedSide) || parsedSide <= 0) {
              toast({ title: "Invalid side length", description: "Please enter a positive number for the side length.", variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'triangle', side: parsedSide });
            break;
          default:
            return;
        }
        setSchematicOutput(result);
      } catch (error) {
        console.error(error);
        toast({
          title: "Generation failed",
          description: "An error occurred while generating the shape. Please try again.",
          variant: "destructive",
        });
        setSchematicOutput(null);
      }
    });
  };
  
  const renderDimensionInputs = () => {
    switch(shape) {
      case 'circle':
        return (
          <div className="space-y-2">
            <Label htmlFor="radius">Radius (pixels)</Label>
            <Input id="radius" type="number" value={dimensions.radius} onChange={e => handleDimensionChange('radius', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      case 'square':
        return (
          <div className="space-y-2">
            <Label htmlFor="width">Width (pixels)</Label>
            <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      case 'triangle':
        return (
          <div className="space-y-2">
            <Label htmlFor="side">Side Length (pixels)</Label>
            <Input id="side" type="number" value={dimensions.side} onChange={e => handleDimensionChange('side', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Shape Generator</CardTitle>
          <CardDescription>Create geometric shapes for your builds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Shape</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as Shape)} className="flex gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="circle" id="r-circle" />
                <Label htmlFor="r-circle">Circle</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="square" id="r-square" />
                <Label htmlFor="r-square">Square</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="triangle" id="r-triangle" />
                <Label htmlFor="r-triangle">Triangle</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? 'Generating...' : 'Generate Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

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
  const [dimensions, setDimensions] = useState({ radius: '16', width: '16', height: '16', side: '16', hexRadius: '16' });
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDimensionChange = (field: keyof typeof dimensions, value: string) => {
    setDimensions(prev => ({...prev, [field]: value}));
  };
  
  const validateAndParse = (value: string, name: string, min = 1): number | null => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < min) {
      toast({ title: `Invalid ${name}`, description: `Please enter a positive number for the ${name}.`, variant: "destructive" });
      return null;
    }
    return parsed;
  }

  const handleGenerate = () => {
    setSchematicOutput(null);
    startTransition(() => {
      try {
        let result: SchematicOutput;
        
        switch(shape) {
          case 'circle': {
            const radius = validateAndParse(dimensions.radius, 'radius');
            if (radius === null) return;
            result = shapeToSchematic({ type: 'circle', radius });
            break;
          }
          case 'square': {
            const width = validateAndParse(dimensions.width, 'width');
            if (width === null) return;
            result = shapeToSchematic({ type: 'square', width, height: width });
            break;
          }
          case 'triangle': {
             const side = validateAndParse(dimensions.side, 'side length');
             if (side === null) return;
            result = shapeToSchematic({ type: 'triangle', side });
            break;
          }
          case 'rhombus': {
            const width = validateAndParse(dimensions.width, 'width');
            const height = validateAndParse(dimensions.height, 'height');
            if (width === null || height === null) return;
            result = shapeToSchematic({ type: 'rhombus', width, height });
            break;
          }
          case 'hexagon': {
            const radius = validateAndParse(dimensions.hexRadius, 'radius');
            if (radius === null) return;
            result = shapeToSchematic({ type: 'hexagon', radius });
            break;
          }
          default:
             toast({ title: 'Unknown shape', description: 'Please select a valid shape.', variant: "destructive" });
            return;
        }
        setSchematicOutput(result);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Generation failed',
          description: 'An error occurred while generating the shape. Please try again.',
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
      case 'rhombus':
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="width">Width (pixels)</Label>
                    <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 32" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="height">Height (pixels)</Label>
                    <Input id="height" type="number" value={dimensions.height} onChange={e => handleDimensionChange('height', e.target.value)} placeholder="e.g. 16" />
                </div>
            </div>
        );
      case 'hexagon':
        return (
          <div className="space-y-2">
            <Label htmlFor="hexRadius">Radius (pixels)</Label>
            <Input id="hexRadius" type="number" value={dimensions.hexRadius} onChange={e => handleDimensionChange('hexRadius', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="bg-card/70 border-primary/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-headline uppercase tracking-wider">Shape Generator</CardTitle>
          <CardDescription>Create geometric shapes for your builds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Shape</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as Shape)} className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2">
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
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rhombus" id="r-rhombus" />
                <Label htmlFor="r-rhombus">Rhombus</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hexagon" id="r-hexagon" />
                <Label htmlFor="r-hexagon">Hexagon</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full uppercase font-bold tracking-wider">
            {isPending ? 'Generating...' : 'Generate Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

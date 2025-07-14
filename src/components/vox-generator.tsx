
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SchematicPreview } from './schematic-preview';
import { useToast } from '@/hooks/use-toast';
import { voxToSchematic, type VoxShape, type SchematicOutput } from '@/lib/schematic-utils';


export function VoxGenerator() {
  const [shape, setShape] = useState<VoxShape>('cuboid');
  const [dimensions, setDimensions] = useState({ 
    width: '16', 
    height: '16', 
    depth: '16', 
    radius: '16', 
    base: '16',
    pyramidHeight: '16' 
  });
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
    startTransition(() => {
      try {
        let result: SchematicOutput;

        switch(shape) {
          case 'cuboid': {
            const width = validateAndParse(dimensions.width, 'width');
            const height = validateAndParse(dimensions.height, 'height');
            const depth = validateAndParse(dimensions.depth, 'depth');
            if (width === null || height === null || depth === null) return;
            result = voxToSchematic({ type: 'cuboid', width, height, depth });
            break;
          }
          case 'sphere': {
            const radius = validateAndParse(dimensions.radius, 'radius');
            if (radius === null) return;
            result = voxToSchematic({ type: 'sphere', radius });
            break;
          }
          case 'pyramid': {
             const base = validateAndParse(dimensions.base, 'base size');
             const height = validateAndParse(dimensions.pyramidHeight, 'height');
             if (base === null || height === null) return;
             result = voxToSchematic({ type: 'pyramid', base, height });
            break;
          }
          default:
             toast({ title: "Unknown shape", description: "Please select a valid shape.", variant: "destructive" });
            return;
        }
        setSchematicOutput(result);
      } catch (error) {
        console.error(error);
        toast({
          title: "Generation failed",
          description: "An error occurred while generating the VOX file.",
          variant: "destructive",
        });
        setSchematicOutput(null);
      }
    });
  };
  
  const renderDimensionInputs = () => {
    switch(shape) {
      case 'cuboid':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width</Label>
              <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <Input id="height" type="number" value={dimensions.height} onChange={e => handleDimensionChange('height', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="depth">Depth</Label>
              <Input id="depth" type="number" value={dimensions.depth} onChange={e => handleDimensionChange('depth', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'sphere':
        return (
          <div className="space-y-2">
            <Label htmlFor="radius">Radius</Label>
            <Input id="radius" type="number" value={dimensions.radius} onChange={e => handleDimensionChange('radius', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      case 'pyramid':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base">Base Size</Label>
              <Input id="base" type="number" value={dimensions.base} onChange={e => handleDimensionChange('base', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pyramidHeight">Height</Label>
              <Input id="pyramidHeight" type="number" value={dimensions.pyramidHeight} onChange={e => handleDimensionChange('pyramidHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
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
          <CardTitle>VOX Generator</CardTitle>
          <CardDescription>Create 3D shapes for your builds in .vox format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>3D Shape</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as VoxShape)} className="flex gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cuboid" id="r-cuboid" />
                <Label htmlFor="r-cuboid">Cuboid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sphere" id="r-sphere" />
                <Label htmlFor="r-sphere">Sphere</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pyramid" id="r-pyramid" />
                <Label htmlFor="r-pyramid">Pyramid</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full">
            {isPending ? 'Generating...' : 'Generate .vox File'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

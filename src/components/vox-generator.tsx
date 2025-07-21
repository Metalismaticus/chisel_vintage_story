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
    pyramidBase: '16',
    pyramidHeight: '16',
    coneRadius: '16',
    coneHeight: '16',
    columnRadius: '8',
    columnHeight: '16',
    archWidth: '16',
    archHeight: '16',
    archDepth: '8',
    diskRadius: '16',
    diskHeight: '1',
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
    setSchematicOutput(null);
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
             const base = validateAndParse(dimensions.pyramidBase, 'base size');
             const height = validateAndParse(dimensions.pyramidHeight, 'height');
             if (base === null || height === null) return;
             result = voxToSchematic({ type: 'pyramid', base, height });
            break;
          }
          case 'column': {
             const radius = validateAndParse(dimensions.columnRadius, 'radius');
             const height = validateAndParse(dimensions.columnHeight, 'height');
             if (radius === null || height === null) return;
             result = voxToSchematic({ type: 'column', radius, height });
            break;
          }
          case 'cone': {
             const radius = validateAndParse(dimensions.coneRadius, 'base radius');
             const height = validateAndParse(dimensions.coneHeight, 'height');
             if (radius === null || height === null) return;
             result = voxToSchematic({ type: 'cone', radius, height });
            break;
          }
          case 'arch': {
             const width = validateAndParse(dimensions.archWidth, 'width');
             const height = validateAndParse(dimensions.archHeight, 'height');
             const depth = validateAndParse(dimensions.archDepth, 'depth');
             if (width === null || height === null || depth === null) return;
             result = voxToSchematic({ type: 'arch', width, height, depth });
             break;
          }
           case 'disk': {
            const radius = validateAndParse(dimensions.diskRadius, 'radius');
            const height = validateAndParse(dimensions.diskHeight, 'height');
            if (radius === null || height === null) return;
            result = voxToSchematic({ type: 'disk', radius, height });
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
          description: 'An error occurred while generating the VOX file. Check console for details.',
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
              <Label htmlFor="width">Width (voxels)</Label>
              <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="height">Height (voxels)</Label>
              <Input id="height" type="number" value={dimensions.height} onChange={e => handleDimensionChange('height', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="depth">Depth (voxels)</Label>
              <Input id="depth" type="number" value={dimensions.depth} onChange={e => handleDimensionChange('depth', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'sphere':
        return (
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (voxels)</Label>
              <Input id="radius" type="number" value={dimensions.radius} onChange={e => handleDimensionChange('radius', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'pyramid':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pyramidBase">Base Size (voxels)</Label>
              <Input id="pyramidBase" type="number" value={dimensions.pyramidBase} onChange={e => handleDimensionChange('pyramidBase', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pyramidHeight">Height (voxels)</Label>
              <Input id="pyramidHeight" type="number" value={dimensions.pyramidHeight} onChange={e => handleDimensionChange('pyramidHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'column':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="columnRadius">Radius (voxels)</Label>
              <Input id="columnRadius" type="number" value={dimensions.columnRadius} onChange={e => handleDimensionChange('columnRadius', e.target.value)} placeholder="e.g. 8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="columnHeight">Height (voxels)</Label>
              <Input id="columnHeight" type="number" value={dimensions.columnHeight} onChange={e => handleDimensionChange('columnHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'cone':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coneRadius">Base Radius (voxels)</Label>
              <Input id="coneRadius" type="number" value={dimensions.coneRadius} onChange={e => handleDimensionChange('coneRadius', e.target.value)} placeholder="e.g. 8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coneHeight">Height (voxels)</Label>
              <Input id="coneHeight" type="number" value={dimensions.coneHeight} onChange={e => handleDimensionChange('coneHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'arch':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="archWidth">Width (voxels)</Label>
              <Input id="archWidth" type="number" value={dimensions.archWidth} onChange={e => handleDimensionChange('archWidth', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="archHeight">Height (voxels)</Label>
              <Input id="archHeight" type="number" value={dimensions.archHeight} onChange={e => handleDimensionChange('archHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="archDepth">Depth (voxels)</Label>
              <Input id="archDepth" type="number" value={dimensions.archDepth} onChange={e => handleDimensionChange('archDepth', e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>
        );
       case 'disk':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="diskRadius">Radius (voxels)</Label>
              <Input id="diskRadius" type="number" value={dimensions.diskRadius} onChange={e => handleDimensionChange('diskRadius', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="diskHeight">Height (voxels)</Label>
              <Input id="diskHeight" type="number" value={dimensions.diskHeight} onChange={e => handleDimensionChange('diskHeight', e.target.value)} placeholder="e.g. 1" />
            </div>
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
          <CardTitle className="font-headline uppercase tracking-wider">VOX Generator</CardTitle>
          <CardDescription>Create 3D shapes for your builds in .vox format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>3D Shape</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as VoxShape)} className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-2">
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
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="column" id="r-column" />
                <Label htmlFor="r-column">Column</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cone" id="r-cone" />
                <Label htmlFor="r-cone">Cone</Label>
              </div>
               <div className="flex items-center space-x-2">
                <RadioGroupItem value="arch" id="r-arch" />
                <Label htmlFor="r-arch">Arch</Label>
              </div>
               <div className="flex items-center space-x-2">
                <RadioGroupItem value="disk" id="r-disk" />
                <Label htmlFor="r-disk">Disk</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full uppercase font-bold tracking-wider">
            {isPending ? 'Generating...' : 'Generate .vox File'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

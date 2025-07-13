'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SchematicPreview } from './schematic-preview';

type Shape = 'circle' | 'square' | 'triangle';

export function ShapeGenerator() {
  const [shape, setShape] = useState<Shape>('circle');
  const [dimensions, setDimensions] = useState({ radius: '16', width: '16', side: '16' });
  const [schematic, setSchematic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDimensionChange = (field: keyof typeof dimensions, value: string) => {
    setDimensions(prev => ({...prev, [field]: value}));
  };

  const handleGenerate = () => {
    setLoading(true);
    // Mock generation
    setTimeout(() => {
      let generatedSchematic = `Generated schematic for a ${shape}`;
      if (shape === 'circle') generatedSchematic += ` with radius ${dimensions.radius}px.`;
      if (shape === 'square') generatedSchematic += ` with width ${dimensions.width}px.`;
      if (shape === 'triangle') generatedSchematic += ` with side length ${dimensions.side}px.`;
      setSchematic(generatedSchematic);
      setLoading(false);
    }, 1000);
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
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? 'Generating...' : 'Generate Schematic'}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicData={schematic} loading={loading} />
    </div>
  );
}

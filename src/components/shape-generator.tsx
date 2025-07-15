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
import { useI18n } from '@/locales/client';


export function ShapeGenerator() {
  const [shape, setShape] = useState<Shape>('circle');
  const [dimensions, setDimensions] = useState({ radius: '16', width: '16', side: '16' });
  const [schematicOutput, setSchematicOutput] = useState<SchematicOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useI18n();

  const handleDimensionChange = (field: keyof typeof dimensions, value: string) => {
    setDimensions(prev => ({...prev, [field]: value}));
  };

  const handleGenerate = () => {
    setSchematicOutput(null);
    startTransition(() => {
      try {
        let result: SchematicOutput;
        const parsedRadius = parseInt(dimensions.radius, 10);
        const parsedWidth = parseInt(dimensions.width, 10);
        const parsedSide = parseInt(dimensions.side, 10);

        switch(shape) {
          case 'circle':
            if (isNaN(parsedRadius) || parsedRadius <= 0) {
              toast({ title: t('toast.error.invalidRadiusTitle'), description: t('toast.error.invalidRadiusDescription'), variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'circle', radius: parsedRadius });
            break;
          case 'square':
            if (isNaN(parsedWidth) || parsedWidth <= 0) {
              toast({ title: t('toast.error.invalidWidthTitle'), description: t('toast.error.invalidWidthDescription'), variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'square', width: parsedWidth, height: parsedWidth });
            break;
          case 'triangle':
             if (isNaN(parsedSide) || parsedSide <= 0) {
              toast({ title: t('toast.error.invalidSideLengthTitle'), description: t('toast.error.invalidSideLengthDescription'), variant: "destructive" });
              return;
            }
            result = shapeToSchematic({ type: 'triangle', side: parsedSide });
            break;
          default:
             toast({ title: t('toast.error.unknownShapeTitle'), description: t('toast.error.unknownShapeDescription'), variant: "destructive" });
            return;
        }
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
  
  const renderDimensionInputs = () => {
    switch(shape) {
      case 'circle':
        return (
          <div className="space-y-2">
            <Label htmlFor="radius">{t('shape.radiusLabel')} (pixels)</Label>
            <Input id="radius" type="number" value={dimensions.radius} onChange={e => handleDimensionChange('radius', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      case 'square':
        return (
          <div className="space-y-2">
            <Label htmlFor="width">{t('shape.widthLabel')} (pixels)</Label>
            <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 16" />
          </div>
        );
      case 'triangle':
        return (
          <div className="space-y-2">
            <Label htmlFor="side">{t('shape.sideLengthLabel')} (pixels)</Label>
            <Input id="side" type="number" value={dimensions.side} onChange={e => handleDimensionChange('side', e.target.value)} placeholder="e.g. 16" />
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
          <CardTitle className="font-headline uppercase tracking-wider">{t('shape.title')}</CardTitle>
          <CardDescription>{t('shape.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('shape.shapeLabel')}</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as Shape)} className="flex gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="circle" id="r-circle" />
                <Label htmlFor="r-circle">{t('shape.circle')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="square" id="r-square" />
                <Label htmlFor="r-square">{t('shape.square')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="triangle" id="r-triangle" />
                <Label htmlFor="r-triangle">{t('shape.triangle')}</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full uppercase font-bold tracking-wider">
            {isPending ? t('buttons.generating') : t('buttons.generateSchematic')}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

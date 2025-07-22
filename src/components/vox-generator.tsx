
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SchematicPreview } from './schematic-preview';
import { useToast } from '@/hooks/use-toast';
import type { VoxShape } from '@/lib/schematic-utils';
import { useI18n } from '@/locales/client';
import { generateVoxFlow, type VoxOutput } from '@/ai/flows/vox-flow';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export function VoxGenerator() {
  const t = useI18n();
  const [shape, setShape] = useState<VoxShape['type']>('cuboid');
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
  const [spherePart, setSpherePart] = useState<'full' | 'hemisphere'>('full');
  const [hemisphereDirection, setHemisphereDirection] = useState<'top' | 'bottom' | 'vertical'>('top');
  const [diskPart, setDiskPart] = useState<'full' | 'half'>('full');
  const [halfDiskDirection, setHalfDiskDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  const [schematicOutput, setSchematicOutput] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const handleDimensionChange = (field: keyof typeof dimensions, value: string) => {
    setDimensions(prev => ({...prev, [field]: value}));
  };
  
  const validateAndParse = (value: string, name: string, min = 1): number | null => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < min) {
      toast({ title: t('voxGenerator.errors.invalid', { name }), description: t('voxGenerator.errors.enterPositiveNumber', { name }), variant: "destructive" });
      return null;
    }
    return parsed;
  }

  const handleGenerate = async () => {
    setSchematicOutput(null);
    let shapeParams: VoxShape | null = null;

    try {
      switch(shape) {
        case 'cuboid': {
          const width = validateAndParse(dimensions.width, t('voxGenerator.dims.width'));
          const height = validateAndParse(dimensions.height, t('voxGenerator.dims.height'));
          const depth = validateAndParse(dimensions.depth, t('voxGenerator.dims.depth'));
          if (width === null || height === null || depth === null) return;
          shapeParams = { type: 'cuboid', width, height, depth };
          break;
        }
        case 'sphere': {
          const radius = validateAndParse(dimensions.radius, t('voxGenerator.dims.radius'));
          if (radius === null) return;
          let part: VoxShape['part'] = 'full';
          if (spherePart === 'hemisphere') {
            part = `hemisphere-${hemisphereDirection}`;
          }
          shapeParams = { type: 'sphere', radius, part };
          break;
        }
        case 'pyramid': {
           const base = validateAndParse(dimensions.pyramidBase, t('voxGenerator.dims.baseSize'));
           const height = validateAndParse(dimensions.pyramidHeight, t('voxGenerator.dims.height'));
           if (base === null || height === null) return;
           shapeParams = { type: 'pyramid', base, height };
          break;
        }
        case 'column': {
           const radius = validateAndParse(dimensions.columnRadius, t('voxGenerator.dims.radius'));
           const height = validateAndParse(dimensions.columnHeight, t('voxGenerator.dims.height'));
           if (radius === null || height === null) return;
           shapeParams = { type: 'column', radius, height };
          break;
        }
        case 'cone': {
           const radius = validateAndParse(dimensions.coneRadius, t('voxGenerator.dims.baseRadius'));
           const height = validateAndParse(dimensions.coneHeight, t('voxGenerator.dims.height'));
           if (radius === null || height === null) return;
           shapeParams = { type: 'cone', radius, height };
          break;
        }
        case 'arch': {
           const width = validateAndParse(dimensions.archWidth, t('voxGenerator.dims.width'));
           const height = validateAndParse(dimensions.archHeight, t('voxGenerator.dims.height'));
           const depth = validateAndParse(dimensions.archDepth, t('voxGenerator.dims.depth'));
           if (width === null || height === null || depth === null) return;
           shapeParams = { type: 'arch', width, height, depth };
           break;
        }
         case 'disk': {
          const radius = validateAndParse(dimensions.diskRadius, t('voxGenerator.dims.radius'));
          const height = validateAndParse(dimensions.diskHeight, t('voxGenerator.dims.height'));
          if (radius === null || height === null) return;
          let part: VoxShape['part'] = 'full';
          if (diskPart === 'half') {
            part = `half-${halfDiskDirection}`;
          }
          shapeParams = { type: 'disk', radius, height, part };
          break;
        }
        default:
           toast({ title: t('voxGenerator.errors.unknownShape'), description: t('voxGenerator.errors.selectValidShape'), variant: "destructive" });
          return;
      }
    } catch (e) {
      console.error(e);
      toast({ title: t('common.errors.generationFailed'), description: (e instanceof Error) ? e.message : String(e), variant: 'destructive' });
      return;
    }

    if (!shapeParams) {
      return;
    }

    setIsPending(true);
    try {
      const result: VoxOutput = await generateVoxFlow(shapeParams);
      // The flow returns voxData as a Base64 string. We need to convert it back to a Uint8Array for download.
      const voxDataBytes = Buffer.from(result.voxData, 'base64');
      setSchematicOutput({ ...result, voxData: voxDataBytes });

    } catch (error) {
       console.error(error);
        toast({
          title: t('common.errors.generationFailed'),
          description: (error instanceof Error) ? error.message : t('common.errors.serverError'),
          variant: "destructive",
        });
        setSchematicOutput(null);
    } finally {
      setIsPending(false);
    }
  };
  
  const renderDimensionInputs = () => {
    switch(shape) {
      case 'cuboid':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">{t('voxGenerator.dims.width')} (voxels)</Label>
              <Input id="width" type="number" value={dimensions.width} onChange={e => handleDimensionChange('width', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="height">{t('voxGenerator.dims.height')} (voxels)</Label>
              <Input id="height" type="number" value={dimensions.height} onChange={e => handleDimensionChange('height', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="depth">{t('voxGenerator.dims.depth')} (voxels)</Label>
              <Input id="depth" type="number" value={dimensions.depth} onChange={e => handleDimensionChange('depth', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'sphere':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="radius">{t('voxGenerator.dims.radius')} (voxels)</Label>
              <Input id="radius" type="number" value={dimensions.radius} onChange={e => handleDimensionChange('radius', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('voxGenerator.sphere.type')}</Label>
                 <RadioGroup value={spherePart} onValueChange={(v) => setSpherePart(v as any)} className="flex pt-2 space-x-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="sphere-full" />
                        <Label htmlFor="sphere-full">{t('voxGenerator.sphere.types.full')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hemisphere" id="sphere-hemi" />
                        <Label htmlFor="sphere-hemi">{t('voxGenerator.sphere.types.hemisphere')}</Label>
                    </div>
                </RadioGroup>
              </div>
              {spherePart === 'hemisphere' && (
                <div className="space-y-2">
                    <Label htmlFor="hemisphere-direction">{t('voxGenerator.sphere.orientation')}</Label>
                    <Select value={hemisphereDirection} onValueChange={(v) => setHemisphereDirection(v as any)}>
                        <SelectTrigger id="hemisphere-direction">
                            <SelectValue placeholder={t('voxGenerator.sphere.selectDirection')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="top">{t('voxGenerator.sphere.orientations.top')}</SelectItem>
                            <SelectItem value="bottom">{t('voxGenerator.sphere.orientations.bottom')}</SelectItem>
                            <SelectItem value="vertical">{t('voxGenerator.sphere.orientations.vertical')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              )}
            </div>
          </div>
        );
      case 'pyramid':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pyramidBase">{t('voxGenerator.dims.baseSize')} (voxels)</Label>
              <Input id="pyramidBase" type="number" value={dimensions.pyramidBase} onChange={e => handleDimensionChange('pyramidBase', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pyramidHeight">{t('voxGenerator.dims.height')} (voxels)</Label>
              <Input id="pyramidHeight" type="number" value={dimensions.pyramidHeight} onChange={e => handleDimensionChange('pyramidHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'column':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="columnRadius">{t('voxGenerator.dims.radius')} (voxels)</Label>
              <Input id="columnRadius" type="number" value={dimensions.columnRadius} onChange={e => handleDimensionChange('columnRadius', e.target.value)} placeholder="e.g. 8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="columnHeight">{t('voxGenerator.dims.height')} (voxels)</Label>
              <Input id="columnHeight" type="number" value={dimensions.columnHeight} onChange={e => handleDimensionChange('columnHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'cone':
        return (
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coneRadius">{t('voxGenerator.dims.baseRadius')} (voxels)</Label>
              <Input id="coneRadius" type="number" value={dimensions.coneRadius} onChange={e => handleDimensionChange('coneRadius', e.target.value)} placeholder="e.g. 8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coneHeight">{t('voxGenerator.dims.height')} (voxels)</Label>
              <Input id="coneHeight" type="number" value={dimensions.coneHeight} onChange={e => handleDimensionChange('coneHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
          </div>
        );
      case 'arch':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="archWidth">{t('voxGenerator.dims.width')} (voxels)</Label>
              <Input id="archWidth" type="number" value={dimensions.archWidth} onChange={e => handleDimensionChange('archWidth', e.target.value)} placeholder="e.g. 16" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="archHeight">{t('voxGenerator.dims.height')} (voxels)</Label>
              <Input id="archHeight" type="number" value={dimensions.archHeight} onChange={e => handleDimensionChange('archHeight', e.target.value)} placeholder="e.g. 16" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="archDepth">{t('voxGenerator.dims.depth')} (voxels)</Label>
              <Input id="archDepth" type="number" value={dimensions.archDepth} onChange={e => handleDimensionChange('archDepth', e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>
        );
       case 'disk':
        return (
           <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="diskRadius">{t('voxGenerator.dims.radius')} (voxels)</Label>
                <Input id="diskRadius" type="number" value={dimensions.diskRadius} onChange={e => handleDimensionChange('diskRadius', e.target.value)} placeholder="e.g. 16" />
                </div>
                <div className="space-y-2">
                <Label htmlFor="diskHeight">{t('voxGenerator.dims.height')} (voxels)</Label>
                <Input id="diskHeight" type="number" value={dimensions.diskHeight} onChange={e => handleDimensionChange('diskHeight', e.target.value)} placeholder="e.g. 1" />
                </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('voxGenerator.disk.type')}</Label>
                 <RadioGroup value={diskPart} onValueChange={(v) => setDiskPart(v as any)} className="flex pt-2 space-x-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="disk-full" />
                        <Label htmlFor="disk-full">{t('voxGenerator.disk.types.full')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="half" id="disk-half" />
                        <Label htmlFor="disk-half">{t('voxGenerator.disk.types.half')}</Label>
                    </div>
                </RadioGroup>
              </div>
              {diskPart === 'half' && (
                <div className="space-y-2">
                    <Label htmlFor="halfdisk-direction">{t('voxGenerator.disk.orientation')}</Label>
                    <Select value={halfDiskDirection} onValueChange={(v) => setHalfDiskDirection(v as any)}>
                        <SelectTrigger id="halfdisk-direction">
                            <SelectValue placeholder={t('voxGenerator.disk.selectDirection')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="horizontal">{t('voxGenerator.disk.orientations.horizontal')}</SelectItem>
                            <SelectItem value="vertical">{t('voxGenerator.disk.orientations.vertical')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              )}
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
          <CardTitle>{t('voxGenerator.title')}</CardTitle>
          <CardDescription>{t('voxGenerator.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('voxGenerator.shapeLabel')}</Label>
            <RadioGroup value={shape} onValueChange={(value) => setShape(value as VoxShape['type'])} className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cuboid" id="r-cuboid" />
                <Label htmlFor="r-cuboid">{t('voxGenerator.shapes.cuboid')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sphere" id="r-sphere" />
                <Label htmlFor="r-sphere">{t('voxGenerator.shapes.sphere')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pyramid" id="r-pyramid" />
                <Label htmlFor="r-pyramid">{t('voxGenerator.shapes.pyramid')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="column" id="r-column" />
                <Label htmlFor="r-column">{t('voxGenerator.shapes.column')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cone" id="r-cone" />
                <Label htmlFor="r-cone">{t('voxGenerator.shapes.cone')}</Label>
              </div>
               <div className="flex items-center space-x-2">
                <RadioGroupItem value="arch" id="r-arch" />
                <Label htmlFor="r-arch">{t('voxGenerator.shapes.arch')}</Label>
              </div>
               <div className="flex items-center space-x-2">
                <RadioGroupItem value="disk" id="r-disk" />
                <Label htmlFor="r-disk">{t('voxGenerator.shapes.disk')}</Label>
              </div>
            </RadioGroup>
          </div>
          {renderDimensionInputs()}
          <Button onClick={handleGenerate} disabled={isPending} className="w-full uppercase font-bold tracking-wider">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.generating')}
              </>
            ) : t('voxGenerator.button')}
          </Button>
        </CardContent>
      </Card>
      <SchematicPreview schematicOutput={schematicOutput} loading={isPending} />
    </div>
  );
}

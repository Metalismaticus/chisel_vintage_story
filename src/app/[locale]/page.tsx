'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextConstructor } from "@/components/text-constructor";
import { ImageConverter } from "@/components/image-converter";
import { ShapeGenerator } from "@/components/shape-generator";
import { VoxGenerator } from "@/components/vox-generator";
import { Cog } from "lucide-react";
import { useI18n } from "@/locales/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  const t = useI18n();
  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 my-4 border-b-2 border-primary/50 pb-4 px-8 text-center">
        <Cog className="w-16 h-16 text-primary animate-spin" style={{ animationDuration: '10s' }} />
        <h1 className="text-4xl md:text-5xl font-headline text-foreground font-bold tracking-wider uppercase">
          {t('title')}
        </h1>
      </header>
      <main className="w-full max-w-6xl p-4 border border-foreground/30 bg-background/50 rounded-lg shadow-2xl">
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="text">{t('tabs.text')}</TabsTrigger>
            <TabsTrigger value="image">{t('tabs.image')}</TabsTrigger>
            <TabsTrigger value="shape">{t('tabs.shape')}</TabsTrigger>
            <TabsTrigger value="vox">{t('tabs.vox')}</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-6">
            <TextConstructor />
          </TabsContent>
          <TabsContent value="image" className="mt-6">
            <ImageConverter />
          </TabsContent>
          <TabsContent value="shape" className="mt-6">
            <ShapeGenerator />
          </TabsContent>
          <TabsContent value="vox" className="mt-6">
            <VoxGenerator />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="flex flex-col items-center gap-4 mt-8 text-muted-foreground">
        <Button asChild variant="link" className="text-lg">
          <Link href="https://metalismaticus.github.io/TOPS/" target="_blank" rel="noopener noreferrer">
            русский гайд для игры на TOPS
          </Link>
        </Button>
        <span>by Metalismatic</span>
      </footer>
    </div>
  );
}

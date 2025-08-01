'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextConstructor } from "@/components/text-constructor";
import { ImageConverter } from "@/components/image-converter";
import { ShapeGenerator } from "@/components/shape-generator";
import { VoxGenerator } from "@/components/vox-generator";
import { VtmlConverter } from "@/components/vtml-converter";
import { useI18n } from "@/locales/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VintageVisionsLogo } from "@/components/vintage-visions-logo";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function Home() {
  const t = useI18n();
  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 my-4 border-b-2 border-primary/50 pb-4 px-8 text-center">
        <VintageVisionsLogo className="w-16 h-16 text-primary animate-spin-slow" />
        <h1 className="text-4xl md:text-5xl font-headline text-foreground font-bold tracking-wider uppercase">
          {t('title')}
        </h1>
      </header>
      <main className="w-full max-w-6xl p-4 border border-foreground/30 bg-background/50 rounded-lg shadow-2xl">
        <Tabs defaultValue="vtml" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="text">{t('tabs.text')}</TabsTrigger>
            <TabsTrigger value="image">{t('tabs.image')}</TabsTrigger>
            <TabsTrigger value="shape">{t('tabs.shape')}</TabsTrigger>
            <TabsTrigger value="vox">{t('tabs.vox')}</TabsTrigger>
            <TabsTrigger value="vtml">{t('tabs.vtml')}</TabsTrigger>
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
           <TabsContent value="vtml" className="mt-6">
            <VtmlConverter />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="w-full max-w-6xl flex justify-between items-center mt-8 text-muted-foreground px-2">
        <Button asChild variant="link" className="text-muted-foreground hover:text-primary transition-colors">
          <Link href="https://metalismaticus.github.io/TOPS/" target="_blank" rel="noopener noreferrer">
            русский гайд для игры на TOPS
          </Link>
        </Button>
        <span>by Metalismatic</span>
      </footer>
    </div>
  );
}

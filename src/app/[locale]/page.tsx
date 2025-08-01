
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

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M8.5 14.5s-1.5-1.5-1.5-3c0-1.5 1.5-3 1.5-3" />
        <path d="M15.5 14.5s1.5-1.5 1.5-3c0-1.5-1.5-3-1.5-3" />
        <path d="M9 10h6" />
        <path d="M12 14c-2 0-3-1-3-1" />
    </svg>
);


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
        <div className="flex items-center gap-4">
            <Link href="https://discord.com/users/698122435266084975" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
               <svg
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 fill-current"
               >
                <title>Discord</title>
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8852-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4463.8163-.5797 1.2534-1.8447-.2762-3.68-.2762-5.4868 0-.1334-.437-several content-.8163-.5797-1.2534a.0741.0741 0 00-.0785-.0371 19.7913 19.7913 0 00-4.8852 1.5152.069.069 0 00-.0321.0232c-1.8447 3.17-2.6182 6.6186-2.6182 10.1557a.069.069 0 00.0465.069c1.6212.4863 3.2282.8728 4.8107 1.139a.0741.0741 0 00.083-.0321c.4463-.63 1.139-1.5152 1.139-1.5152s-.4463-.211-.792-.3753c-.314-.1334-.5797-.244-.792-.314a.0741.0741 0 01-.0321-.083c.0465-.0465.0785-.0785.1152-.1152a.0741.0741 0 01.069-.0156l.0156.0078c.0785.0371.1448.0785.211.123a10.5932 10.5932 0 003.343.8385.0741.0741 0 00.069-.0156l.0156-.0078c.0785-.0371.1448-.0785.211-.123a10.5932 10.5932 0 003.343-.8385.0741.0741 0 00.083.0156c.0371.0232.069.0547.1152.1074a.0741.0741 0 01-.0321.083c-.211.069-.4766.1804-.792.314-.314.1648-.792.3753-.792.3753s.6927.8852 1.139 1.5152a.0741.0741 0 00.083.0321c1.5825-.2684 3.1895-.655 4.8107-1.139a.069.069 0 00.0465-.069c0-3.537-.7735-6.9856-2.6182-10.1557a.069.069 0 00-.0321-.0232zM8.02 15.3312c-.7735 0-1.4015-.629-1.4015-1.4015s.628-1.4015 1.4015-1.4015c.7735 0 1.4015.629 1.4015 1.4015.0078.7725-.628 1.4015-1.4015 1.4015zm7.9548 0c-.7735 0-1.4015-.629-1.4015-1.4015s.628-1.4015 1.4015-1.4015c.7735 0 1.4015.629 1.4015 1.4015s-.628 1.4015-1.4015 1.4015z" />
               </svg>
               <span className="sr-only">Discord</span>
            </Link>
            <span>by Metalismatic</span>
        </div>
      </footer>
    </div>
  );
}

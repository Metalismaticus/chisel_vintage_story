import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextConstructor } from "@/components/text-constructor";
import { ImageConverter } from "@/components/image-converter";
import { ShapeGenerator } from "@/components/shape-generator";
import { VintageVisionsLogo } from "@/components/vintage-visions-logo";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 mb-8">
        <VintageVisionsLogo className="w-12 h-12 text-primary" />
        <h1 className="text-4xl md:text-5xl font-headline text-foreground font-bold">
          Vintage Visions
        </h1>
      </header>
      <main className="w-full max-w-5xl">
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text">Text Constructor</TabsTrigger>
            <TabsTrigger value="image">Image Converter</TabsTrigger>
            <TabsTrigger value="shape">Shape Generator</TabsTrigger>
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
        </Tabs>
      </main>
    </div>
  );
}

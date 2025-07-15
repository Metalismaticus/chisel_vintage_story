import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster";
import './globals.css';
import { Oswald, Roboto_Condensed } from 'next/font/google';
import { I18nProvider } from '@/locales/client';

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  weight: ['400', '700'],
});

const robotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  variable: '--font-roboto-condensed',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'helper for chiselling',
  description: 'Create pixel art schematics for Vintage Story',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
      </head>
      <body className={`${oswald.variable} ${robotoCondensed.variable} font-body antialiased`}>
        <I18nProvider>
          {children}
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}

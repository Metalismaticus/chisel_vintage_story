import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster";
import '../globals.css';
import { Oswald, Roboto_Condensed } from 'next/font/google';
import I18nProviderClient from '@/locales/provider';
import { getCurrentLocale } from '@/locales/server';

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

export default async function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const currentLocale = await getCurrentLocale();
  return (
    <html className="dark" lang={currentLocale}>
      <head>
      </head>
      <body className={`${oswald.variable} ${robotoCondensed.variable} font-body antialiased`}>
        <I18nProviderClient locale={locale}>
          {children}
        </I18nProviderClient>
        <Toaster />
      </body>
    </html>
  );
}

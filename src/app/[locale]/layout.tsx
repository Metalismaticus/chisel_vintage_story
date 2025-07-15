import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster";
import '../globals.css';
import { Oswald, Roboto_Condensed } from 'next/font/google';
import { getCurrentLocale } from '@/locales/server';
import { I18nProviderClient } from '@/locales/client';
import LanguageSwitcher from '@/components/language-switcher';

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
  return (
    <I18nProviderClient locale={locale}>
      <html className="dark">
        <head>
        </head>
        <body className={`${oswald.variable} ${robotoCondensed.variable} font-body antialiased`}>
          <div className="absolute top-4 right-4 z-10">
            <LanguageSwitcher />
          </div>
          {children}
          <Toaster />
        </body>
      </html>
    </I18nProviderClient>
  );
}

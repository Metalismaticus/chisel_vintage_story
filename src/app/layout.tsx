import type { Metadata } from 'next';
import { Oswald, Roboto_Condensed } from 'next/font/google';
import './globals.css';
import { ReactNode } from 'react';

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
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${oswald.variable} ${robotoCondensed.variable} font-body antialiased dark`}>
      <body>{children}</body>
    </html>
  );
}

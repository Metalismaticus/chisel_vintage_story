'use client';

import { createI18nClient } from 'next-international/client';
import { Oswald, Roboto_Condensed } from 'next/font/google';

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


export const { useI18n, useScopedI18n, I18nProviderClient, useChangeLocale, useCurrentLocale } = createI18nClient(
  {
    en: () => import('./en'),
    ru: () => import('./ru'),
  },
  {
    htmlClassName: `${oswald.variable} ${robotoCondensed.variable} font-body antialiased dark`,
    // The middleware will handle the locale detection and redirection.
  },
);

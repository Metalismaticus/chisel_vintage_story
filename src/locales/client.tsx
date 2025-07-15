'use client';
import { createI18nClient } from 'next-international/client';

export const { useI18n, useScopedI18n, I18nProvider, useChangeLocale, useCurrentLocale } = createI18nClient(
  {
    en: () => import('./en').then(m => m.default),
    ru: () => import('./ru').then(m => m.default),
  },
  {
    // Uncomment to set the default locale
    // defaultLocale: 'en',
  },
);

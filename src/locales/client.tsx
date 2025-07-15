'use client';
import { createI18nClient } from 'next-international/client';

export const { useI18n, useScopedI18n, I18nProvider, useChangeLocale, useCurrentLocale } = createI18nClient(
  {
    en: () => import('./en'),
    ru: () => import('./ru'),
  },
  {
    // Uncomment to set the default locale
    // defaultLocale: 'en',
  },
);

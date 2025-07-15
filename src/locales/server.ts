import { createI18nServer } from 'next-international/server';
 
export const { getI18n, getScopedI18n, getStaticParams, getCurrentLocale } = createI18nServer({
  en: () => import('./en').then(m => m.default),
  ru: () => import('./ru').then(m => m.default),
});
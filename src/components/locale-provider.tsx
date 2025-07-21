'use client';

import type { ReactNode } from 'react';
import { I18nProviderClient } from '@/locales/client';
import LanguageSwitcher from '@/components/language-switcher';
import { Toaster } from "@/components/ui/toaster";

export function LocaleProvider({
  children,
  locale
}: {
  children: ReactNode;
  locale: string;
}) {
  return (
    <I18nProviderClient locale={locale}>
      <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
      </div>
      {children}
      <Toaster />
    </I18nProviderClient>
  );
}

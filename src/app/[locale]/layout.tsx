'use client';
import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster";
import '../globals.css';
import { I18nProviderClient } from '@/locales/client';
import LanguageSwitcher from '@/components/language-switcher';

export default function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
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

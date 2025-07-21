import type { ReactNode } from 'react';
import '../globals.css';
import { LocaleProvider } from '@/components/locale-provider';

export default function LocaleLayout({
  children,
  params: { locale }
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return (
    <LocaleProvider locale={locale}>
      {children}
    </LocaleProvider>
  );
}

import type { ReactNode } from 'react';
import '../globals.css';
import { LocaleProvider } from '@/components/locale-provider';

export default function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  return (
    <LocaleProvider locale={locale}>
      {children}
    </LocaleProvider>
  );
}

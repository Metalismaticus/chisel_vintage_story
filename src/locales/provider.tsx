'use client';

import { I18nProvider } from 'next-international/client';
import type { ReactNode } from 'react';

export default function I18nProviderClient({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  return (
    <I18nProvider
      locale={locale}
      fallback={
        // Optional: use `de` locale as fallback
        <div>loading...</div>
      }
      // Optional: disable on-demand loading
      // loadOnDemand={false}
    >
      {children}
    </I18nProvider>
  );
}

'use client';
import { I18nProviderClient, useCurrentLocale } from '@/locales/client';
import RootLayout from './[locale]/layout';
import HomePage from './[locale]/page';


export default function Page() {
    const locale = useCurrentLocale()
    return (
    <I18nProviderClient locale={locale}>
      <RootLayout params={{ locale }}>
        <HomePage />
      </RootLayout>
    </I18nProviderClient>
    )
}
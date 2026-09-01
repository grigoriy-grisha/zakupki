import './globals.css';

import type { Metadata } from 'next';
import { Cormorant_Infant, JetBrains_Mono, Raleway } from 'next/font/google';
import Script from 'next/script';

import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-provider';
import { TrpcProvider } from '@/lib/client/trpc-provider';

const raleway = Raleway({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-raleway',
    display: 'swap',
});

const cormorantInfant = Cormorant_Infant({
    subsets: ['latin', 'cyrillic'],
    weight: ['600', '700'],
    style: ['normal', 'italic'],
    variable: '--font-cormorant',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Закупки',
    description: 'Система совместных закупок',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="ru"
            suppressHydrationWarning
            className={`${raleway.variable} ${cormorantInfant.variable} ${jetbrainsMono.variable}`}
        >
            <body className="antialiased" suppressHydrationWarning>
                <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
                <Script src="https://telegram.org/js/telegram-widget.js" strategy="lazyOnload" />
                <AuthProvider>
                    <TrpcProvider>{children}</TrpcProvider>
                </AuthProvider>
                <Toaster />
            </body>
        </html>
    );
}

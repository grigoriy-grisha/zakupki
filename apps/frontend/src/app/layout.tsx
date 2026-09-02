import './globals.css';

import type { Metadata } from 'next';
import { Cormorant_Infant, Inter, JetBrains_Mono, Raleway } from 'next/font/google';
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
    style: ['normal', 'italic'],
    variable: '--font-cormorant',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});

const inter = Inter({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-inter',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'Щеглов — совместные закупки',
        template: '%s | Щеглов',
    },
    description:
        'Совместные закупки японского и чешского бисера, фурнитуры и инструментов для творчества премиального качества.',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: '48x48' },
            { url: '/favicon.svg', type: 'image/svg+xml' },
            { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
        ],
        apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
    openGraph: {
        type: 'website',
        locale: 'ru_RU',
        siteName: 'Щеглов — совместные закупки',
        title: 'Щеглов — совместные закупки',
        description:
            'Японский и чешский бисер, фурнитура и инструменты для творчества по совместным закупкам.',
        images: [{ url: '/web-app-manifest-512x512.png', width: 512, height: 512, alt: 'Щеглов' }],
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="ru"
            suppressHydrationWarning
            className={`${raleway.variable} ${cormorantInfant.variable} ${jetbrainsMono.variable} ${inter.variable}`}
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

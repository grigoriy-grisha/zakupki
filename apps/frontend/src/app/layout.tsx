import './globals.css';

import type { Metadata } from 'next';
import Script from 'next/script';

import { AuthProvider } from '@/lib/auth-provider';
import { TrpcProvider } from '@/lib/client/trpc-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
    title: 'Закупки',
    description: 'Система совместных закупок',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ru" suppressHydrationWarning>
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

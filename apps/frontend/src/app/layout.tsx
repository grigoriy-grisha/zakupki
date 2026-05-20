import './globals.css';

import type { Metadata } from 'next';

import { TrpcProvider } from '@/lib/client/trpc-provider';

export const metadata: Metadata = {
    title: 'Закупки',
    description: 'Система совместных закупок',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ru">
            <body className="antialiased">
                <TrpcProvider>{children}</TrpcProvider>
            </body>
        </html>
    );
}

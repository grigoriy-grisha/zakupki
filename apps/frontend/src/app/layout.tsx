import './globals.css';

import type { Metadata } from 'next';

import { AuthProvider } from '@/lib/auth-provider';
import { TrpcProvider } from '@/lib/client/trpc-provider';
import { VkAuthProvider } from '@/lib/vk-auth-provider';

export const metadata: Metadata = {
    title: 'Закупки',
    description: 'Система совместных закупок',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ru">
            <body className="antialiased">
                <AuthProvider>
                    <VkAuthProvider>
                        <TrpcProvider>{children}</TrpcProvider>
                    </VkAuthProvider>
                </AuthProvider>
            </body>
        </html>
    );
}

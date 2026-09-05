'use client';

import './globals.css';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    console.error(error);

    return (
        <html lang="ru">
            <body className="antialiased">
                <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 py-16 text-center">
                    <p aria-hidden className="font-display text-[5rem] italic leading-none text-gold select-none">
                        ✳
                    </p>
                    <h1 className="mt-4 font-display text-3xl italic text-fg-primary">
                        Приложение не удалось загрузить
                    </h1>
                    <p className="mt-3 max-w-md text-14-regular text-fg-secondary">
                        Произошла непредвиденная ошибка. Обновите страницу — если не поможет, загляните чуть позже.
                    </p>
                    <Button variant="brand" size="lg" className="mt-8 rounded-full" onClick={reset}>
                        <RefreshCw className="size-4" />
                        Обновить
                    </Button>
                </main>
            </body>
        </html>
    );
}

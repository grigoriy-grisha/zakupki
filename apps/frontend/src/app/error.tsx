'use client';

import { House, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    // tRPC-ошибки приходят с понятным русским текстом (например, «Товар закупки не найден») —
    // показываем его, а для системных сбоев остаётся общий текст.
    const detail = error?.message?.trim();
    const friendlyDetail = detail && detail.length <= 300 ? detail : null;

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-warning/15">
                <TriangleAlert className="size-8 text-warning" />
            </div>

            <h1 className="mt-6 font-display text-3xl italic text-fg-primary sm:text-4xl">
                Что-то пошло не так
            </h1>
            <p className="mt-3 max-w-md text-14-regular text-fg-secondary">
                {friendlyDetail ?? 'Кажется, это временная неполадка. Попробуйте ещё раз — обычно помогает.'}
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Button variant="brand" size="lg" className="rounded-full" onClick={reset}>
                    <RefreshCw className="size-4" />
                    Попробовать снова
                </Button>
                <Button variant="outline" size="lg" className="rounded-full" asChild>
                    <AppLink href="/">
                        <House className="size-4" />
                        На главную
                    </AppLink>
                </Button>
            </div>

            {friendlyDetail && (
                <p className="mt-10 max-w-md text-12-regular text-fg-tertiary">
                    Если проблема повторяется — напишите организатору{' '}
                    <a
                        href="https://t.me/kind_of_girl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary underline underline-offset-2 transition-colors hover:text-primary"
                    >
                        @kind_of_girl
                    </a>
                    , мы разберёмся.
                </p>
            )}
        </main>
    );
}

'use client';

import { ArrowLeft, House } from 'lucide-react';

import { AppLink } from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { useAppRouter } from '@/lib/hooks/use-app-router';

const BEADS = [
    { size: 10, opacity: 0.9 },
    { size: 14, opacity: 0.65 },
    { size: 8, opacity: 1 },
    { size: 16, opacity: 0.55 },
    { size: 10, opacity: 0.85 },
    { size: 6, opacity: 1 },
    { size: 12, opacity: 0.75 },
];

export default function NotFound() {
    const router = useAppRouter();

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-4 py-16 text-center">
            <div className="mb-8 flex items-center gap-2.5" aria-hidden>
                {BEADS.map((bead, index) => (
                    <span
                        key={index}
                        className="rounded-full bg-gold"
                        style={{ width: bead.size, height: bead.size, opacity: bead.opacity }}
                    />
                ))}
            </div>

            <p
                aria-hidden
                className="font-display text-[6.5rem] italic leading-none text-fg-primary select-none sm:text-[9.5rem]"
            >
                4<span className="text-gold">0</span>4
            </p>

            <h1 className="mt-4 font-display text-3xl italic text-fg-primary sm:text-4xl">
                Эта бусина потерялась
            </h1>
            <p className="mt-3 max-w-md text-14-regular text-fg-secondary">
                Страница не найдена: ссылка устарела или в ней опечатка. Зато остальные закупки на месте —
                загляните в магазин.
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                <Button variant="brand" size="lg" className="rounded-full" asChild>
                    <AppLink href="/">
                        <House className="size-4" />
                        На главную
                    </AppLink>
                </Button>
                <Button variant="outline" size="lg" className="rounded-full" onClick={() => router.back()}>
                    <ArrowLeft className="size-4" />
                    Назад
                </Button>
            </div>

            <p className="mt-12 text-12-regular text-fg-tertiary">Щеглов — совместные закупки</p>
        </main>
    );
}

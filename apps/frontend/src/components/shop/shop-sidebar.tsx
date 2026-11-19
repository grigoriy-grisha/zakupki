'use client';

import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from '@zakupki/types';
import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useAppPathname } from '@/lib/hooks/use-app-pathname';
import { useAppRouter } from '@/lib/hooks/use-app-router';
import { cn } from '@/lib/utils';

import { SidebarSlot } from './sidebar-slot';

const WIDTH_STORAGE_KEY = 'shop-sidebar-width';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

function clampWidth(value: number): number {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

/** Ширина левой панели: тянется за линию справа и запоминается в браузере. */
function useResizableWidth() {
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const drag = useRef<{ startX: number; startWidth: number } | null>(null);

    useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
            if (saved) setWidth(clampWidth(saved));
        } catch {
            // localStorage недоступен (приватный режим) — остаёмся на ширине по умолчанию
        }
    }, []);

    function save(value: number) {
        try {
            localStorage.setItem(WIDTH_STORAGE_KEY, String(value));
        } catch {
            // не критично: ширина просто не запомнится
        }
    }

    const handleProps = {
        role: 'separator' as const,
        'aria-orientation': 'vertical' as const,
        'aria-label': 'Ширина панели',
        'aria-valuemin': MIN_WIDTH,
        'aria-valuemax': MAX_WIDTH,
        'aria-valuenow': width,
        tabIndex: 0,
        title: 'Потяните, чтобы изменить ширину',
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { startX: e.clientX, startWidth: width };
            document.body.style.userSelect = 'none';
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
            if (!drag.current) return;
            setWidth(clampWidth(drag.current.startWidth + e.clientX - drag.current.startX));
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
            if (!drag.current) return;
            const next = clampWidth(drag.current.startWidth + e.clientX - drag.current.startX);
            drag.current = null;
            document.body.style.userSelect = '';
            setWidth(next);
            save(next);
        },
        onDoubleClick: () => {
            setWidth(DEFAULT_WIDTH);
            save(DEFAULT_WIDTH);
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const next = clampWidth(width + (e.key === 'ArrowRight' ? 16 : -16));
            setWidth(next);
            save(next);
        },
    };

    return { width, handleProps };
}

interface ShopSidebarProps {
    className?: string;
}

export function ShopSidebar({ className }: ShopSidebarProps) {
    const router = useAppRouter();
    const pathname = useAppPathname();
    const { data: purchases, isLoading } = trpc.purchases.list.useQuery({
        statuses: ['ACTIVE'],
    });

    const { width, handleProps } = useResizableWidth();

    const match = pathname.match(/\/shop\/purchase\/(\d+)/);
    const activePurchaseId = match ? Number(match[1]) : null;

    return (
        <aside
            className={cn('sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 hidden md:flex flex-col', className)}
            style={{ width }}
        >
            {/* Линия справа — ручка: тянуть мышкой, двойной клик возвращает ширину по умолчанию. */}
            <div
                {...handleProps}
                className="group/resize absolute bottom-10 right-0 top-10 z-10 w-3 translate-x-1/2 cursor-col-resize touch-none outline-none"
            >
                <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-secondary transition-[width] group-hover/resize:w-1 group-focus-visible/resize:w-1 group-active/resize:w-1"
                />
            </div>
            {/* Скролл тонкий, виден только при наведении и стоит в стороне от линии-ручки. */}
            <div className="mr-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10 pt-8 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-border)_transparent] sm:pt-10">
                <div>
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-8 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : !purchases?.length ? (
                        <p className="text-14-regular text-fg-secondary">Нет активных закупок</p>
                    ) : (
                        <nav className="flex flex-col items-start gap-3.5">
                            {purchases.map((purchase) => {
                                const isActive = activePurchaseId === purchase.id;
                                const fulfillmentStatus = (purchase.fulfillmentStatus ??
                                    'COLLECTION') as PurchaseFulfillmentStatus;
                                const fulfillmentLabel = PURCHASE_FULFILLMENT_LABELS[fulfillmentStatus];

                                return (
                                    <button
                                        key={purchase.id}
                                        type="button"
                                        onClick={() => router.push(`/shop/purchase/${purchase.id}`)}
                                        className="max-w-full text-left transition-colors hover:text-secondary"
                                    >
                                        <span
                                            className={cn(
                                                'font-display leading-tight',
                                                isActive
                                                    ? 'text-24-semibold text-secondary'
                                                    : 'text-18-semibold text-fg-primary',
                                            )}
                                        >
                                            {purchase.tag}
                                        </span>
                                        {isActive && (
                                            <span className="mt-0.5 block truncate text-12-regular text-fg-tertiary">
                                                {fulfillmentLabel}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    )}
                </div>

                <SidebarSlot />
            </div>
        </aside>
    );
}

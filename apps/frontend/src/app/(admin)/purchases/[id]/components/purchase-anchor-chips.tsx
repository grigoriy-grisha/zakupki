'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PurchaseAnchorChipsProps {
    itemsCount: number;
    supplementsCount: number;
    participantsCount: number;
}

const SECTIONS = ['items', 'supplements', 'participants'] as const;
type SectionId = (typeof SECTIONS)[number];

/**
 * Sticky-чипсы для навигации по секциям страницы (Товары / Доборы / Участники).
 * Подсвечивает активный якорь, smooth-scroll при клике.
 */
export function PurchaseAnchorChips({
    itemsCount,
    supplementsCount,
    participantsCount,
}: PurchaseAnchorChipsProps) {
    const [active, setActive] = useState<SectionId>('items');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const elements = SECTIONS.map((id) => document.getElementById(id)).filter(
            (el): el is HTMLElement => el != null,
        );
        if (elements.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]?.target.id) {
                    setActive(visible[0].target.id as SectionId);
                }
            },
            { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
        );
        elements.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const counts: Record<SectionId, number> = {
        items: itemsCount,
        supplements: supplementsCount,
        participants: participantsCount,
    };
    const labels: Record<SectionId, string> = {
        items: 'Товары',
        supplements: 'Доборы',
        participants: 'Участники',
    };

    return (
        <div className="sticky top-14 z-20 -mx-4 bg-bg-base/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-bg-base/70 md:mx-0 md:px-0">
            <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-bg-card p-1.5">
                {SECTIONS.map((id) => {
                    const isActive = active === id;
                    return (
                        <a
                            key={id}
                            href={`#${id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(id);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    setActive(id);
                                }
                            }}
                            className={cn(
                                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-13-medium transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-fg-secondary hover:bg-bg-soft hover:text-fg-primary',
                            )}
                        >
                            {labels[id]}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-12-medium tabular-nums',
                                    isActive ? 'bg-primary-foreground/20' : 'bg-bg-soft text-fg-tertiary',
                                )}
                            >
                                {counts[id]}
                            </span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}

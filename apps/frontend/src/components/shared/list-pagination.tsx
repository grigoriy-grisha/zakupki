'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ListPaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    label: string;
    className?: string;
}

function buildPages(page: number, totalPages: number): (number | '…')[] {
    const pages: (number | '…')[] = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
            pages.push(p);
        } else if (pages[pages.length - 1] !== '…') {
            pages.push('…');
        }
    }
    return pages;
}

export function ListPagination({ page, totalPages, onPageChange, label, className }: ListPaginationProps) {
    if (totalPages <= 1) return null;

    const btnClass = (active: boolean) =>
        cn(
            'flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-12-medium tabular-nums transition-colors',
            active ? 'bg-secondary text-primary-foreground' : 'text-fg-secondary hover:bg-bg-soft',
        );

    return (
        <nav className={cn('flex items-center justify-center gap-1', className)} aria-label={label}>
            <button
                type="button"
                aria-label="Предыдущая страница"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
                className={cn(btnClass(false), 'disabled:pointer-events-none disabled:opacity-40')}
            >
                <ChevronLeft className="size-3.5" />
            </button>
            {buildPages(page, totalPages).map((p, i) =>
                p === '…' ? (
                    <span key={`dots-${i}`} className="px-0.5 text-12-medium text-fg-tertiary">
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        aria-current={p === page ? 'page' : undefined}
                        onClick={() => onPageChange(p)}
                        className={btnClass(p === page)}
                    >
                        {p}
                    </button>
                ),
            )}
            <button
                type="button"
                aria-label="Следующая страница"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
                className={cn(btnClass(false), 'disabled:pointer-events-none disabled:opacity-40')}
            >
                <ChevronRight className="size-3.5" />
            </button>
        </nav>
    );
}

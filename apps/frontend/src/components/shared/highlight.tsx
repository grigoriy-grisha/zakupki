'use client';

import { Fragment } from 'react';

import { cn } from '@/lib/utils';

interface HighlightProps {
    text: string;
    query: string;
    className?: string;
}

/** Подсветка совпадений подстроки — та же нормализация, что в поиске списка (@ срезается). */
export function Highlight({ text, query, className }: HighlightProps) {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return <span className={className}>{text}</span>;

    const lower = text.toLowerCase();
    const ranges: { start: number; end: number }[] = [];
    let idx = lower.indexOf(q);
    while (idx !== -1) {
        ranges.push({ start: idx, end: idx + q.length });
        idx = lower.indexOf(q, idx + q.length);
    }
    if (ranges.length === 0) return <span className={className}>{text}</span>;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.start > cursor) {
            nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor, range.start)}</span>);
        }
        nodes.push(
            <mark key={`m-${range.start}`} className="rounded-[2px] bg-warning/45 px-px text-inherit ring-1 ring-warning/50 ring-inset">
                {text.slice(range.start, range.end)}
            </mark>,
        );
        cursor = range.end;
    }
    if (cursor < text.length) {
        nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return <span className={cn(className)}>{nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</span>;
}

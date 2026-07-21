'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
    /** Текст для отображения. */
    children: ReactNode;
    /** Полный текст для тултипа (если не задан — берётся textContent children). */
    fullText?: string;
    /** Доп. className для элемента с текстом. */
    className?: string;
    /** Макс. ширина тултипа. */
    tooltipMaxWidth?: string;
}

/**
 * Текст с обрезкой многоточием + тултип с полным текстом при наведении.
 *
 * Тултип показывается **только если текст действительно обрезан** (scrollWidth >
 * clientWidth). Короткий текст не вызывает всплытия тултипа.
 *
 * Важно: родительский контейнер должен иметь `min-w-0` (или flex-shrink), чтобы
 * `truncate` сработал внутри фиксированной колонки таблицы.
 */
export function TruncatedText({
    children,
    fullText,
    className,
    tooltipMaxWidth = 'max-w-xs',
}: TruncatedTextProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);

    function checkOverflow(): boolean {
        const el = ref.current;
        if (!el) return false;
        return el.scrollWidth > el.clientWidth;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip open={open}>
                <TooltipTrigger asChild>
                    <span
                        ref={ref}
                        className={cn('block cursor-default truncate', className)}
                        onPointerEnter={() => {
                            if (checkOverflow()) setOpen(true);
                        }}
                        onPointerLeave={() => setOpen(false)}
                    >
                        {children}
                    </span>
                </TooltipTrigger>
                <TooltipContent className={tooltipMaxWidth}>
                    {fullText ?? extractText(children)}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/** Извлечь строку из ReactNode (для фолбэка тултипа). */
function extractText(node: ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (node == null || node === false || node === true) return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    return '';
}

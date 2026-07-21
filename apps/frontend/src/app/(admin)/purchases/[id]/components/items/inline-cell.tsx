'use client';

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Inline-ячейка таблицы позиций: число (Decimal/Int) с коммитом по blur/Enter.
 *
 * Паттерн:
 * - локальный строковый draft, чтобы юзер мог вводить промежуточные значения;
 * - `useRef(focused)` не даёт эффекту синхронизации затереть ввод во время набора;
 * - `useEffect` синхронизирует draft с серверным `value` после успешной мутации
 *   (только если фокус не на ячейке);
 * - `onBlur` парсит draft и коммитит через `onCommit(Number)` либо откатывает;
 * - Enter триггgerит blur (→ commit), Escape откатывает draft.
 *
 * Стиль «прозрачная, пока не наведён/не в фокусе» повторяет attribute-type-card.
 */
interface InlineCellProps {
    /** Текущее серверное значение (string|number|null|undefined). */
    value: string | number | null | undefined;
    /** Коммит распарсенного числа. Вызывается только если значение изменилось и валидно. */
    onCommit: (next: number) => void;
    /** Вернуть null (очистить поле). По умолчанию null-значения не коммитятся. */
    onClear?: () => void;
    /** Минимально допустимое значение (после парсинга). Default: не ограничено. */
    min?: number;
    /** Разрешить ли отрицательные (например, остаток). Default: false. */
    allowNegative?: boolean;
    /** inputMode для мобильных клавиатур. */
    inputMode?: 'decimal' | 'numeric';
    /** Выравнивание текста. */
    align?: 'right' | 'left' | 'center';
    /** Заполнитель для пустого поля. */
    placeholder?: string;
    disabled?: boolean;
    /** Доп. className. */
    className?: string;
    ariaLabel?: string;
}

function parseInlineNumber(raw: string, opts: { min?: number; allowNegative?: boolean }): number | null {
    const normalized = raw.trim().replace(',', '.');
    if (normalized === '') return null;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    if (!opts.allowNegative && n < 0) return null;
    if (opts.min != null && n < opts.min) return null;
    return n;
}

export function InlineCell({
    value,
    onCommit,
    onClear,
    min,
    allowNegative = false,
    inputMode = 'decimal',
    align = 'right',
    placeholder,
    disabled,
    className,
    ariaLabel,
}: InlineCellProps) {
    const initial = value == null || value === '' ? '' : String(value);
    const [draft, setDraft] = useState(initial);
    const focused = useRef(false);

    useEffect(() => {
        if (!focused.current) {
            setDraft(value == null || value === '' ? '' : String(value));
        }
    }, [value]);

    function commit() {
        const opts = { min, allowNegative };
        const parsed = parseInlineNumber(draft, opts);
        if (parsed == null) {
            // Пустое значение → onClear, иначе откат к серверному.
            if (draft.trim() === '' && onClear) {
                onClear();
            } else {
                setDraft(value == null || value === '' ? '' : String(value));
            }
            return;
        }
        const current = value == null || value === '' ? null : Number(value);
        if (current == null || parsed !== current) onCommit(parsed);
    }

    return (
        <Input
            inputMode={inputMode}
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onFocus={() => {
                focused.current = true;
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
                focused.current = false;
                commit();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                    focused.current = false;
                    setDraft(value == null || value === '' ? '' : String(value));
                    (e.target as HTMLInputElement).blur();
                }
            }}
            className={cn(
                'h-7 w-full min-w-0 rounded-md border border-border bg-bg-card px-1 text-13-medium tabular-nums shadow-xs hover:border-ring focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                align === 'left' && 'text-left',
                className,
            )}
        />
    );
}

/**
 * Inline-ячейка для свободного текста (например, комментарий организатора).
 * Коммитит по blur/Enter, откатывает по Escape. Пустая строка → onClear.
 */
interface InlineTextCellProps {
    value: string | null | undefined;
    onCommit: (next: string) => void;
    onClear?: () => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

export function InlineTextCell({
    value,
    onCommit,
    onClear,
    placeholder,
    disabled,
    className,
    ariaLabel,
}: InlineTextCellProps) {
    const [draft, setDraft] = useState(value ?? '');
    const focused = useRef(false);

    useEffect(() => {
        if (!focused.current) setDraft(value ?? '');
    }, [value]);

    function commit() {
        const trimmed = draft.trim();
        if (trimmed === '') {
            if ((value ?? '') !== '' && onClear) onClear();
            return;
        }
        if (trimmed !== (value ?? '')) onCommit(trimmed);
    }

    return (
        <Input
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onFocus={() => {
                focused.current = true;
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
                focused.current = false;
                commit();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                    focused.current = false;
                    setDraft(value ?? '');
                    (e.target as HTMLInputElement).blur();
                }
            }}
            className={cn(
                'h-7 w-full min-w-0 rounded-md border border-border bg-bg-card px-1 text-12-regular text-fg-secondary shadow-xs hover:border-ring focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30',
                className,
            )}
        />
    );
}

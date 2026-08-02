'use client';

import { Check } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PackingRowProps {
    /** Размер пачки (в единицах товара: г или шт). */
    size: number;
    /** Сколько таких пачек нужно. */
    needed: number;
    /** Короткое имя единицы ('гр' / 'шт' / 'туба') — для подписи. */
    unitShortName: string;
    /** Сколько уже собрано (из localStorage родителя). */
    collected: number;
    onChange: (next: number) => void;
    disabled?: boolean;
}

const clamp = (n: number, needed: number) => Math.max(0, Math.min(needed, n));

/** Одна строка плана фасовки: размер — нужно — собрано. */
export function PackingRow({ size, needed, unitShortName, collected, onChange, disabled }: PackingRowProps) {
    const done = collected >= needed;
    const over = collected > needed;

    const handleChange = (raw: string) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            onChange(0);
            return;
        }
        onChange(clamp(Math.round(n), needed));
    };

    return (
        <div
            className={cn(
                'flex items-center gap-3 border-b border-border-soft px-3 py-2 last:border-b-0',
                done && 'opacity-60',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {done ? (
                    <Check className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                    <span
                        className="inline-block size-4 shrink-0 rounded-full border border-border-soft"
                        aria-hidden
                    />
                )}
                <span
                    className={cn(
                        'text-14-medium tabular-nums text-fg-primary',
                        done && 'line-through',
                    )}
                >
                    {size} {unitShortName}
                </span>
                <span className="text-12-regular text-fg-tertiary">нужно {needed}</span>
                {over && (
                    <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-11-medium text-warning">
                        больше нужного
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <label className="text-12-regular text-fg-tertiary" htmlFor={`collected-${size}`}>
                    Собрано
                </label>
                <Input
                    id={`collected-${size}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={needed}
                    step={1}
                    disabled={disabled}
                    value={collected || '0'}
                    onChange={(e) => handleChange(e.target.value)}
                    aria-label={`Собрано ${size} ${unitShortName}`}
                    className={cn('h-8 w-20 text-center tabular-nums', over && 'border-warning')}
                />
            </div>
        </div>
    );
}

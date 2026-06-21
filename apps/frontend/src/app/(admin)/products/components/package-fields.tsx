'use client';

import { Plus, X } from 'lucide-react';
import { PACKAGE_UNITS } from '../lib';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import { FormSection } from '@/components/ui/form-section';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PackageUnitSelect } from './package-unit-select';
import { cn } from '@/lib/utils';

/** Пустое поле вместо 0 — удобнее вводить цену с нуля. */
function numInputValue(n: number, emptyWhenZero = true): string | number {
    if (emptyWhenZero && n === 0) return '';
    return n;
}

function parseIntegerInput(raw: string): number {
    if (raw === '' || raw === '-') return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function parseDecimalInput(raw: string): number {
    if (raw === '' || raw === '-') return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function integerInputValue(value: number | null | undefined, emptyWhenZero = false): string {
    if (value == null) return '';
    if (emptyWhenZero && value === 0) return '';
    return String(Math.trunc(value));
}

/**
 * Редактор ценовых ступеней (тиров).
 *
 * Layout каждой строки:
 *   [amount]  [unit]  —  [price] ₽  [×]
 *
 * `amount` — кол-во единиц (например, 5 гр). `unit` — ед. измерения. `price` — стоимость за amount ед.
 */
export function PriceTierEditor({
    tiers,
    onChange,
    label = 'Цены',
    required = true,
    addTierLabel = 'Добавить тир',
    error,
}: {
    tiers: { amount: number; unit: string; price: number }[];
    onChange: (tiers: { amount: number; unit: string; price: number }[]) => void;
    label?: string;
    required?: boolean;
    addTierLabel?: string;
    error?: string | null;
}) {
    return (
        <FormField
            label={
                <span>
                    {label}
                    {required && <span className="ml-0.5 text-error">*</span>}
                </span>
            }
            error={error}
        >
            <div className="space-y-2">
                {tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="1"
                            min={1}
                            inputMode="numeric"
                            className="h-9 w-20 shrink-0 rounded-xl text-13-medium tabular-nums"
                            value={numInputValue(tier.amount)}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], amount: parseIntegerInput(e.target.value) };
                                onChange(next);
                            }}
                            aria-label="Количество"
                        />
                        <PackageUnitSelect
                            value={tier.unit}
                            onChange={(v) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], unit: v };
                                onChange(next);
                            }}
                        />
                        <span className="shrink-0 text-13-regular text-fg-tertiary">—</span>
                        <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="h-9 min-w-0 flex-1 rounded-xl text-13-medium tabular-nums"
                            value={numInputValue(tier.price)}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], price: parseDecimalInput(e.target.value) };
                                onChange(next);
                            }}
                            aria-label="Цена"
                        />
                        <span className="shrink-0 text-12-regular text-fg-tertiary">₽</span>
                        {tiers.length > 1 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Удалить ступень"
                                        className="size-8 shrink-0 rounded-full text-fg-tertiary hover:bg-bg-soft hover:text-error"
                                        onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Удалить ступень</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                ))}
            </div>
            <div className="pt-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onChange([...tiers, { amount: 0, unit: PACKAGE_UNITS[0], price: 0 }])}
                >
                    <Plus className="size-3.5" />
                    {addTierLabel}
                </Button>
            </div>
        </FormField>
    );
}

/**
 * Редактор фасовки (amount + unit + опц. price).
 *
 * Используется для: «Мин. фасовка», «Фасовка поставщика», «Лимит у поставщика».
 */
export function PackageEditor({
    label,
    amount,
    unit,
    price,
    onAmountChange,
    onUnitChange,
    onPriceChange,
    showPrice = false,
    description,
    className,
}: {
    label: string;
    amount: number | null;
    unit: string;
    price?: number | null;
    onAmountChange: (v: number | null) => void;
    onUnitChange: (v: string) => void;
    onPriceChange?: (v: number | null) => void;
    showPrice?: boolean;
    description?: React.ReactNode;
    className?: string;
}) {
    return (
        <FormField label={label} hint={description} className={className}>
            <div
                className={cn(
                    'flex flex-wrap items-center gap-2',
                )}
            >
                <Input
                    type="number"
                    step="1"
                    min={0}
                    inputMode="numeric"
                    className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                    value={integerInputValue(amount)}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onAmountChange(raw === '' ? null : parseIntegerInput(raw));
                    }}
                    aria-label="Количество"
                />
                <PackageUnitSelect value={unit} onChange={onUnitChange} />
                {showPrice && onPriceChange && (
                    <>
                        <span className="shrink-0 text-13-regular text-fg-tertiary">—</span>
                        <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="h-9 min-w-0 flex-1 rounded-xl text-13-medium tabular-nums"
                            value={price ?? ''}
                            onChange={(e) => {
                                const raw = e.target.value;
                                onPriceChange(raw === '' ? null : parseDecimalInput(raw));
                            }}
                            aria-label="Цена"
                        />
                        <span className="shrink-0 text-12-regular text-fg-tertiary">₽</span>
                    </>
                )}
            </div>
        </FormField>
    );
}

/** Используется как wrapper для обёртки в FormSection. */
export function PackageEditorSection(props: React.ComponentProps<typeof PackageEditor>) {
    return <PackageEditor {...props} />;
}

/** Re-export — обратная совместимость, если где-то импортируется `Label`. */
export { Label };

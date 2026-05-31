'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { PACKAGE_UNITS } from '../lib';
import { PackageUnitSelect } from './package-unit-select';

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

export function PriceTierEditor({
    tiers,
    onChange,
}: {
    tiers: { amount: number; unit: string; price: number }[];
    onChange: (tiers: { amount: number; unit: string; price: number }[]) => void;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <Label>
                    Цены <span className="text-destructive">*</span>
                </Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([...tiers, { amount: 1, unit: PACKAGE_UNITS[0], price: 0 }])}
                >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Добавить тир
                </Button>
            </div>
            <div className="space-y-2">
                {tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="1"
                            min={1}
                            inputMode="numeric"
                            className="w-20"
                            placeholder="1"
                            value={numInputValue(tier.amount, false)}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], amount: parseIntegerInput(e.target.value) || 1 };
                                onChange(next);
                            }}
                        />
                        <PackageUnitSelect
                            value={tier.unit}
                            onChange={(v) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], unit: v };
                                onChange(next);
                            }}
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="flex-1"
                            placeholder="Цена"
                            value={numInputValue(tier.price)}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], price: parseDecimalInput(e.target.value) };
                                onChange(next);
                            }}
                        />
                        <span className="text-sm text-muted-foreground">₽</span>
                        {tiers.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PackageEditor({
    label,
    amount,
    unit,
    price,
    onAmountChange,
    onUnitChange,
    onPriceChange,
    showPrice = false,
}: {
    label: string;
    amount: number | null;
    unit: string;
    price?: number | null;
    onAmountChange: (v: number | null) => void;
    onUnitChange: (v: string) => void;
    onPriceChange?: (v: number | null) => void;
    showPrice?: boolean;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    step="1"
                    min={0}
                    inputMode="numeric"
                    className={showPrice ? 'w-24' : 'flex-1'}
                    value={integerInputValue(amount)}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onAmountChange(raw === '' ? null : parseIntegerInput(raw));
                    }}
                />
                <PackageUnitSelect value={unit} onChange={onUnitChange} />
                {showPrice && onPriceChange && (
                    <>
                        <span className="text-muted-foreground">—</span>
                        <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="flex-1"
                            value={price ?? ''}
                            onChange={(e) => {
                                const raw = e.target.value;
                                onPriceChange(raw === '' ? null : parseDecimalInput(raw));
                            }}
                        />
                        <span className="text-sm text-muted-foreground">₽</span>
                    </>
                )}
            </div>
        </div>
    );
}

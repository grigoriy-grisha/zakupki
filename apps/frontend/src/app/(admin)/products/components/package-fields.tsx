'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { PACKAGE_UNITS } from '../lib';

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
                <Label>Цены</Label>
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
                            step="0.001"
                            className="w-20"
                            value={tier.amount}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], amount: Number(e.target.value) };
                                onChange(next);
                            }}
                        />
                        <UnitSelect
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
                            className="flex-1"
                            value={tier.price}
                            onChange={(e) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], price: Number(e.target.value) };
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
    amountStep = '0.001',
    priceStep = '0.01',
    showPrice = false,
}: {
    label: string;
    amount: number | null;
    unit: string;
    price?: number | null;
    onAmountChange: (v: number | null) => void;
    onUnitChange: (v: string) => void;
    onPriceChange?: (v: number | null) => void;
    amountStep?: string;
    priceStep?: string;
    showPrice?: boolean;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    step={amountStep}
                    className={showPrice ? 'w-24' : 'flex-1'}
                    value={amount ?? ''}
                    onChange={(e) => onAmountChange(e.target.value ? Number(e.target.value) : null)}
                />
                <UnitSelect value={unit} onChange={onUnitChange} />
                {showPrice && onPriceChange && (
                    <>
                        <span className="text-muted-foreground">—</span>
                        <Input
                            type="number"
                            step={priceStep}
                            className="flex-1"
                            value={price ?? ''}
                            onChange={(e) => onPriceChange(e.target.value ? Number(e.target.value) : null)}
                        />
                        <span className="text-sm text-muted-foreground">₽</span>
                    </>
                )}
            </div>
        </div>
    );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <select className="border rounded-md px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
            {PACKAGE_UNITS.map((u) => (
                <option key={u} value={u}>
                    {u}
                </option>
            ))}
        </select>
    );
}

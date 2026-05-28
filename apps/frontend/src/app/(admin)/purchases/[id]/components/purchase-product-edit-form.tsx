'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Loader2, Plus, X } from 'lucide-react';
import {
    PACKAGE_UNITS,
    productToDescriptionFields,
    useAutoProductDescription,
    type ProductLabelSource,
} from '../../../products/lib';

export type PurchaseProductSaveData = {
    description?: string;
    pricePerUnit: number;
    priceTiers: { amount: number; unit: string; price: number }[];
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
    availableAmount: number | null;
    availableUnit: string | null;
};

interface PurchaseProductEditFormProps {
    product: ProductLabelSource & {
        id: number;
        minPackageAmount?: string | number | null;
        minPackageUnit?: string | null;
        supplierPackageAmount?: string | number | null;
        supplierPackageUnit?: string | null;
        supplierPackagePrice?: string | number | null;
        availableAmount?: string | number | null;
        availableUnit?: string | null;
        description?: string | null;
        priceTiers?: unknown;
    };
    initialTiers: { amount: number; unit: string; price: number }[];
    onSave: (data: PurchaseProductSaveData) => void;
    isSaving: boolean;
    submitLabel?: string;
    footer?: React.ReactNode;
    purchaseTag?: string;
}

export function PurchaseProductEditForm({
    product,
    initialTiers,
    onSave,
    isSaving,
    submitLabel = 'Сохранить',
    footer,
    purchaseTag,
}: PurchaseProductEditFormProps) {
    const [description, setDescription] = useState(product.description ?? '');
    const [tiers, setTiers] = useState(
        initialTiers.length > 0 ? initialTiers : [{ amount: 1, unit: PACKAGE_UNITS[0], price: 0 }],
    );
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(
        product.minPackageAmount != null ? Number(product.minPackageAmount) : null,
    );
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(product.minPackageUnit ?? PACKAGE_UNITS[0]);
    const [supPkgAmount, setSupPkgAmount] = useState<number | null>(
        product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null,
    );
    const [supPkgUnit, setSupPkgUnit] = useState<string | null>(product.supplierPackageUnit ?? PACKAGE_UNITS[0]);
    const [supPkgPrice, setSupPkgPrice] = useState<number | null>(
        product.supplierPackagePrice != null ? Number(product.supplierPackagePrice) : null,
    );
    const [availAmount, setAvailAmount] = useState<number | null>(
        product.availableAmount != null ? Number(product.availableAmount) : null,
    );
    const [availUnit, setAvailUnit] = useState<string | null>(product.availableUnit ?? PACKAGE_UNITS[0]);

    const descriptionFields = useMemo(
        () => ({
            ...productToDescriptionFields(product),
            name: product.name,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
            priceTiers: tiers,
            supplierPackageAmount: supPkgAmount,
            supplierPackageUnit: supPkgUnit,
            supplierPackagePrice: supPkgPrice,
            availableAmount: availAmount,
            availableUnit: availUnit,
            purchaseTag,
        }),
        [
            product,
            minPkgAmount,
            minPkgUnit,
            tiers,
            supPkgAmount,
            supPkgUnit,
            supPkgPrice,
            availAmount,
            availUnit,
            purchaseTag,
        ],
    );

    useAutoProductDescription(descriptionFields, setDescription);

    function handleSave() {
        const firstTier = tiers[0];
        if (!firstTier?.amount || firstTier.price <= 0) return;
        const pricePerUnit = firstTier.price / firstTier.amount;

        onSave({
            description: description || undefined,
            pricePerUnit,
            priceTiers: tiers,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
            supplierPackageAmount: supPkgAmount,
            supplierPackageUnit: supPkgUnit,
            supplierPackagePrice: supPkgPrice,
            availableAmount: availAmount,
            availableUnit: availUnit,
        });
    }

    return (
        <div className="space-y-4 px-4">
            <div className="space-y-1">
                <Label>Описание</Label>
                <NovelEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Описание заполнится автоматически из полей ниже..."
                />
                <p className="text-xs text-muted-foreground">
                    Заполняется автоматически из полей ниже. Можно дописать вручную.
                </p>
            </div>

            <div className="space-y-1">
                <Label>Минимальная фасовка</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        className="flex-1"
                        value={minPkgAmount ?? ''}
                        onChange={(e) => setMinPkgAmount(e.target.value ? Number(e.target.value) : null)}
                    />
                    <UnitSelect value={minPkgUnit ?? PACKAGE_UNITS[0]} onChange={setMinPkgUnit} />
                </div>
            </div>

            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <Label>Цены</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            setTiers((prev) => [...prev, { amount: 1, unit: PACKAGE_UNITS[0], price: 0 }])
                        }
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Добавить тир
                    </Button>
                </div>
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
                                setTiers(next);
                            }}
                        />
                        <UnitSelect
                            value={tier.unit}
                            onChange={(v) => {
                                const next = [...tiers];
                                next[i] = { ...next[i], unit: v };
                                setTiers(next);
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
                                setTiers(next);
                            }}
                        />
                        <span className="text-sm text-muted-foreground">₽</span>
                        {tiers.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>

            <div className="space-y-1">
                <Label>Фасовка поставщика</Label>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        className="w-24"
                        value={supPkgAmount ?? ''}
                        onChange={(e) => setSupPkgAmount(e.target.value ? Number(e.target.value) : null)}
                    />
                    <UnitSelect value={supPkgUnit ?? PACKAGE_UNITS[0]} onChange={setSupPkgUnit} />
                    <span className="text-muted-foreground">—</span>
                    <Input
                        type="number"
                        step="0.01"
                        className="flex-1"
                        value={supPkgPrice ?? ''}
                        onChange={(e) => setSupPkgPrice(e.target.value ? Number(e.target.value) : null)}
                    />
                    <span className="text-sm text-muted-foreground">₽</span>
                </div>
            </div>

            <div className="space-y-1">
                <Label>Свободно</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        className="flex-1"
                        value={availAmount ?? ''}
                        onChange={(e) => setAvailAmount(e.target.value ? Number(e.target.value) : null)}
                    />
                    <UnitSelect value={availUnit ?? PACKAGE_UNITS[0]} onChange={setAvailUnit} />
                </div>
            </div>

            {footer}

            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
            </Button>
        </div>
    );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {PACKAGE_UNITS.map((u) => (
                <option key={u} value={u}>
                    {u}
                </option>
            ))}
        </select>
    );
}

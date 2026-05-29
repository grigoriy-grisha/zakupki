'use client';

import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { PriceTierEditor, PackageEditor } from '../../../products/components/package-fields';
import {
    PACKAGE_UNITS,
    applyPostTemplate,
    buildShowInTitleByTypeId,
    productToDescriptionFields,
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
    /** Загрузить цены/фасовку/описание из карточки товара (правка уже добавленного в закупку). */
    loadSavedDescription?: boolean;
}

const DEFAULT_TIER = { amount: 1, unit: PACKAGE_UNITS[0], price: 0 };

function emptyPurchaseFields() {
    return {
        description: '',
        tiers: [{ ...DEFAULT_TIER }],
        minPkgAmount: null as number | null,
        minPkgUnit: PACKAGE_UNITS[0],
        supPkgAmount: null as number | null,
        supPkgUnit: PACKAGE_UNITS[0],
        supPkgPrice: null as number | null,
        availAmount: null as number | null,
        availUnit: PACKAGE_UNITS[0],
        templateId: 'none',
    };
}

function savedPurchaseFields(
    product: PurchaseProductEditFormProps['product'],
    initialTiers: { amount: number; unit: string; price: number }[],
) {
    return {
        description: product.description ?? '',
        tiers: initialTiers.length > 0 ? initialTiers : [{ ...DEFAULT_TIER }],
        minPkgAmount: product.minPackageAmount != null ? Number(product.minPackageAmount) : null,
        minPkgUnit: product.minPackageUnit ?? PACKAGE_UNITS[0],
        supPkgAmount: product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null,
        supPkgUnit: product.supplierPackageUnit ?? PACKAGE_UNITS[0],
        supPkgPrice: product.supplierPackagePrice != null ? Number(product.supplierPackagePrice) : null,
        availAmount: product.availableAmount != null ? Number(product.availableAmount) : null,
        availUnit: product.availableUnit ?? PACKAGE_UNITS[0],
        templateId: 'none',
    };
}

export function PurchaseProductEditForm({
    product,
    initialTiers,
    onSave,
    isSaving,
    submitLabel = 'Сохранить',
    footer,
    purchaseTag,
    loadSavedDescription = false,
}: PurchaseProductEditFormProps) {
    const initial = loadSavedDescription
        ? savedPurchaseFields(product, initialTiers)
        : emptyPurchaseFields();

    const [description, setDescription] = useState(initial.description);
    const [tiers, setTiers] = useState(initial.tiers);
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(initial.minPkgAmount);
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(initial.minPkgUnit);
    const [supPkgAmount, setSupPkgAmount] = useState<number | null>(initial.supPkgAmount);
    const [supPkgUnit, setSupPkgUnit] = useState<string | null>(initial.supPkgUnit);
    const [supPkgPrice, setSupPkgPrice] = useState<number | null>(initial.supPkgPrice);
    const [availAmount, setAvailAmount] = useState<number | null>(initial.availAmount);
    const [availUnit, setAvailUnit] = useState<string | null>(initial.availUnit);
    const [templateId, setTemplateId] = useState(initial.templateId);

    useEffect(() => {
        const next = loadSavedDescription
            ? savedPurchaseFields(product, initialTiers)
            : emptyPurchaseFields();
        setTemplateId(next.templateId);
        setDescription(next.description);
        setTiers(next.tiers);
        setMinPkgAmount(next.minPkgAmount);
        setMinPkgUnit(next.minPkgUnit);
        setSupPkgAmount(next.supPkgAmount);
        setSupPkgUnit(next.supPkgUnit);
        setSupPkgPrice(next.supPkgPrice);
        setAvailAmount(next.availAmount);
        setAvailUnit(next.availUnit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product.id, loadSavedDescription]);

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();
    const { data: attributeTypes, isSuccess: attributeTypesReady } = trpc.attributeTypes.list.useQuery();
    const showInTitleByTypeId = useMemo(
        () => buildShowInTitleByTypeId(attributeTypes),
        [attributeTypes],
    );
    const selectedTemplateBody =
        templateId === 'none'
            ? null
            : (postTemplates?.find((t: { id: number; body: string }) => t.id === Number(templateId))?.body ??
              null);

    const descriptionFields = useMemo(
        () => ({
            ...productToDescriptionFields(product, showInTitleByTypeId, attributeTypes),
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
            showInTitleByTypeId,
            attributeTypes,
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

    useEffect(() => {
        if (templateId === 'none' || !attributeTypesReady) return;
        const body = selectedTemplateBody?.trim();
        if (!body) return;
        setDescription(applyPostTemplate(body, descriptionFields));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, selectedTemplateBody, descriptionFields, attributeTypesReady]);

    function handleTemplateChange(value: string) {
        setTemplateId(value);
        if (value === 'none') {
            setDescription('');
            return;
        }
        const body = postTemplates?.find((t: { id: number; body: string }) => t.id === Number(value))?.body;
        if (body?.trim() && attributeTypesReady) {
            setDescription(applyPostTemplate(body, descriptionFields));
        }
    }

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
                <Label>Шаблон поста</Label>
                <Select value={templateId} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Без шаблона" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Без шаблона</SelectItem>
                        {(postTemplates ?? []).map((t: { id: number; name: string }) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1">
                <Label>Описание</Label>
                <div className="max-h-[35vh] overflow-y-auto rounded-md border">
                    <NovelEditor
                        value={description}
                        onChange={setDescription}
                        placeholder={
                            templateId === 'none'
                                ? 'Текст описания для поста…'
                                : 'Подставится из шаблона при изменении полей ниже…'
                        }
                    />
                </div>
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

            <PriceTierEditor tiers={tiers} onChange={setTiers} />

            <PackageEditor
                label="Фасовка поставщика"
                amount={supPkgAmount}
                unit={supPkgUnit ?? PACKAGE_UNITS[0]}
                price={supPkgPrice}
                onAmountChange={setSupPkgAmount}
                onUnitChange={setSupPkgUnit}
                onPriceChange={setSupPkgPrice}
                showPrice
            />

            <PackageEditor
                label="Свободно"
                amount={availAmount}
                unit={availUnit ?? PACKAGE_UNITS[0]}
                onAmountChange={setAvailAmount}
                onUnitChange={setAvailUnit}
            />

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

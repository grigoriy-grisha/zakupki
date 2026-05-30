'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { PriceTierEditor, PackageEditor } from '../../../products/components/package-fields';
import { PackageUnitSelect } from '../../../products/components/package-unit-select';
import {
    PACKAGE_UNITS,
    applyPostTemplate,
    buildShowInTitleByTypeId,
    productToDescriptionFields,
    type ProductLabelSource,
} from '../../../products/lib';
import {
    emptyPurchaseFields,
    persistTemplateChoice,
    resolveDefaultTemplateId,
    savedPurchaseFields,
    type PurchaseProductFormState,
} from '../lib/purchase-product-fields';

export type PurchaseProductSaveData = {
    description?: string;
    pricePerUnit?: number;
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

function applyPurchaseFields(setters: {
    setDescription: (v: string) => void;
    setTiers: (v: PurchaseProductFormState['tiers']) => void;
    setMinPkgAmount: (v: number | null) => void;
    setMinPkgUnit: (v: string | null) => void;
    setSupPkgAmount: (v: number | null) => void;
    setSupPkgUnit: (v: string | null) => void;
    setSupPkgPrice: (v: number | null) => void;
    setAvailAmount: (v: number | null) => void;
    setAvailUnit: (v: string | null) => void;
}, next: PurchaseProductFormState) {
    setters.setDescription(next.description);
    setters.setTiers(next.tiers);
    setters.setMinPkgAmount(next.minPkgAmount);
    setters.setMinPkgUnit(next.minPkgUnit);
    setters.setSupPkgAmount(next.supPkgAmount);
    setters.setSupPkgUnit(next.supPkgUnit);
    setters.setSupPkgPrice(next.supPkgPrice);
    setters.setAvailAmount(next.availAmount);
    setters.setAvailUnit(next.availUnit);
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
    const [templateId, setTemplateId] = useState('none');

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();

    useEffect(() => {
        const next = loadSavedDescription
            ? savedPurchaseFields(product, initialTiers)
            : emptyPurchaseFields();
        applyPurchaseFields(
            {
                setDescription,
                setTiers,
                setMinPkgAmount,
                setMinPkgUnit,
                setSupPkgAmount,
                setSupPkgUnit,
                setSupPkgPrice,
                setAvailAmount,
                setAvailUnit,
            },
            next,
        );

        if (loadSavedDescription) {
            const defaultTemplate = resolveDefaultTemplateId(product.id, postTemplates);
            setTemplateId(defaultTemplate);
            if (defaultTemplate !== 'none') {
                persistTemplateChoice(product.id, defaultTemplate);
            }
        } else {
            setTemplateId('none');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product.id, loadSavedDescription, postTemplates]);

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

    const templatedHtml = useMemo(() => {
        if (templateId === 'none' || !attributeTypesReady) return null;
        const body = selectedTemplateBody?.trim();
        if (!body) return null;
        return applyPostTemplate(body, descriptionFields);
    }, [templateId, selectedTemplateBody, descriptionFields, attributeTypesReady]);

    const lastAutoDescriptionRef = useRef<string | null>(null);
    const descriptionCustomizedRef = useRef(
        loadSavedDescription ? Boolean(product.description?.trim()) : false,
    );

    useEffect(() => {
        if (templatedHtml == null) return;
        if (descriptionCustomizedRef.current && description !== lastAutoDescriptionRef.current) return;
        setDescription(templatedHtml);
        lastAutoDescriptionRef.current = templatedHtml;
        descriptionCustomizedRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-apply template when it regenerates
    }, [templatedHtml]);

    function handleDescriptionChange(html: string) {
        setDescription(html);
        descriptionCustomizedRef.current = true;
    }

    const editorKey = templateId === 'none' ? `manual-${product.id}` : `tpl-${templateId}-${product.id}`;

    function handleTemplateChange(value: string) {
        setTemplateId(value);
        persistTemplateChoice(product.id, value);
        descriptionCustomizedRef.current = false;
        lastAutoDescriptionRef.current = null;
        if (value === 'none') {
            setDescription(loadSavedDescription ? (product.description ?? '') : '');
        }
    }

    function handleSave() {
        const firstTier = tiers[0];
        const pricePerUnit =
            firstTier?.amount && firstTier.amount > 0 && firstTier.price > 0
                ? firstTier.price / firstTier.amount
                : undefined;

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
                <Label>Минимальная фасовка</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.001"
                        className="flex-1"
                        value={minPkgAmount ?? ''}
                        onChange={(e) => setMinPkgAmount(e.target.value ? Number(e.target.value) : null)}
                    />
                    <PackageUnitSelect value={minPkgUnit ?? PACKAGE_UNITS[0]} onChange={setMinPkgUnit} />
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

            <div className="space-y-1">
                <Label>Описание</Label>
                <div className="max-h-[35vh] overflow-y-auto rounded-md border">
                    <NovelEditor
                        key={editorKey}
                        value={description}
                        onChange={handleDescriptionChange}
                        placeholder={
                            templateId === 'none'
                                ? 'Текст описания для поста…'
                                : 'Текст из шаблона — можно дописать своё…'
                        }
                    />
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

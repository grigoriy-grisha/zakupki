'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { FormFooter } from '@/components/ui/form-footer';

import {
    applyPostTemplate,
    buildShowInTitleByTypeId,
    normalizeNovelHtml,
    productToDescriptionFields,
    type ProductLabelSource,
} from '../../../../products/lib';

import {
    buildPurchaseFormState,
    mergeProductAndPurchaseFields,
    normalizeSupplierTiersForSave,
    primarySupplierPackageFromTiers,
    validatePurchasePriceTiers,
} from '../../lib/purchase-price-tiers';
import { persistTemplateChoice, resolveDefaultTemplateId } from '../../lib/template-storage';
import { DescriptionSection } from './purchase-product-edit-form/sections/description-section';
import { MinPackageSection } from './purchase-product-edit-form/sections/min-package-section';
import { PriceTiersSection } from './purchase-product-edit-form/sections/price-tiers-section';
import { SupplementLimitsSection } from './purchase-product-edit-form/sections/supplement-limits-section';
import { SupplierPackageSection } from './purchase-product-edit-form/sections/supplier-package-section';
import { SupplierSection } from './purchase-product-edit-form/sections/supplier-section';
import { TemplateSection } from './purchase-product-edit-form/sections/template-section';

export type PurchaseProductSaveData = {
    supplierId?: number | null;
    description?: string | null;
    priceOverride?: number | null;
    priceTiers: { amount: number; unit: string; price: number }[];
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
    supplierPackageTiers: { amount: number; unit: string; price: number }[];
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string | null;
    targetRemainder: number | null;
};

interface PurchaseProductEditFormProps {
    product: ProductLabelSource & {
        id: number;
        unit?: { shortName?: string | null; name?: string | null } | null;
    };
    /** Per-purchase поля (если форма используется для редактирования существующего PurchaseItem). */
    initialPurchaseFields?: {
        supplierId?: number | null;
        description?: string | null;
        pricePerUnit?: string | number | null;
        priceTiers?: unknown;
        minPackageAmount?: string | number | null;
        minPackageUnit?: string | null;
        supplierPackageAmount?: string | number | null;
        supplierPackageUnit?: string | null;
        supplierPackagePrice?: string | number | null;
        supplierPackageTiers?: unknown;
        supplementStep?: string | number | null;
        supplierLimit?: string | number | null;
        supplierLimitUnit?: string | null;
        targetRemainder?: string | number | null;
    };
    onSave: (data: PurchaseProductSaveData) => void;
    onCancel?: () => void;
    isSaving: boolean;
    submitLabel?: string;
    /** Кастомный footer (опц.). */
    footer?: React.ReactNode;
    purchaseTag?: string;
    /**
     * `true` — загрузить сохранённое описание и применить шаблон по дефолту.
     * Используется при **редактировании** существующего товара в закупке.
     * `false` — пустая форма. Используется при **создании нового**.
     */
    loadSavedDescription?: boolean;
}

function mergeTemplateIntoDescription(
    current: string,
    prevAuto: string | null,
    nextAuto: string,
): string {
    if (!prevAuto) return nextAuto;
    const normCurrent = normalizeNovelHtml(current);
    const normPrev = normalizeNovelHtml(prevAuto);
    const normNext = normalizeNovelHtml(nextAuto);
    if (normCurrent === normPrev) return nextAuto;
    if (normCurrent.startsWith(normPrev)) {
        return nextAuto + current.slice(prevAuto.length);
    }
    if (normCurrent !== normNext) {
        return current;
    }
    return nextAuto;
}

/**
 * Форма редактирования/создания товара в закупке.
 *
 * Секции:
 *  1. Шаблон поста
 *  2. Поставщик (опц.)
 *  3. Мин. фасовка
 *  4. Цены (тиры)
 *  5. Фасовка поставщика
 *  6. Добор и лимиты (supplementStep + supplierLimit + targetRemainder)
 *  7. Описание (NovelEditor)
 *
 * Sticky footer с [Отмена] [Сохранить].
 */
export function PurchaseProductEditForm({
    product,
    initialPurchaseFields,
    onSave,
    onCancel,
    isSaving,
    submitLabel = 'Сохранить',
    footer,
    purchaseTag,
    loadSavedDescription = false,
}: PurchaseProductEditFormProps) {
    const initial = buildPurchaseFormState(
        mergeProductAndPurchaseFields(product, initialPurchaseFields),
        loadSavedDescription,
    );

    const [description, setDescription] = useState(initial.description);
    const [tiers, setTiers] = useState(initial.tiers);
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(initial.minPkgAmount);
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(initial.minPkgUnit);
    const [supPkgTiers, setSupPkgTiers] = useState(initial.supPkgTiers);
    const [supplementStep, setSupplementStep] = useState<number | null>(initial.supplementStep);
    const [supplierLimit, setSupplierLimit] = useState<number | null>(initial.supplierLimit);
    const [supplierLimitUnit, setSupplierLimitUnit] = useState<string | null>(initial.supplierLimitUnit);
    const [targetRemainder, setTargetRemainder] = useState<number | null>(initial.targetRemainder);
    const [supplierId, setSupplierId] = useState<number | null>(initialPurchaseFields?.supplierId ?? null);
    const [templateId, setTemplateId] = useState('none');
    const [descriptionRevision, setDescriptionRevision] = useState(0);
    const [priceError, setPriceError] = useState<string | null>(null);

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();
    const { data: suppliers } = trpc.suppliers.list.useQuery();
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const supplierName = useMemo(() => {
        if (supplierId == null) return null;
        return (suppliers ?? []).find((s) => s.id === supplierId)?.name ?? null;
    }, [supplierId, suppliers]);

    const userPickedTemplateRef = useRef(false);
    const lastAppliedSignatureRef = useRef<string | null>(null);
    const lastAutoDescriptionRef = useRef<string | null>(
        loadSavedDescription && !!normalizeNovelHtml(initial.description)
            ? initial.description
            : null,
    );
    const preserveSavedDescriptionRef = useRef(
        loadSavedDescription && !!normalizeNovelHtml(initial.description),
    );

    useEffect(() => {
        const next = buildPurchaseFormState(
            mergeProductAndPurchaseFields(product, initialPurchaseFields),
            loadSavedDescription,
        );
        setDescription(next.description);
        setTiers(next.tiers);
        setMinPkgAmount(next.minPkgAmount);
        setMinPkgUnit(next.minPkgUnit);
        setSupPkgTiers(next.supPkgTiers);
        setSupplementStep(next.supplementStep);
        setSupplierLimit(next.supplierLimit);
        setSupplierLimitUnit(next.supplierLimitUnit);
        setTargetRemainder(next.targetRemainder);
        setSupplierId(initialPurchaseFields?.supplierId ?? null);

        userPickedTemplateRef.current = false;
        preserveSavedDescriptionRef.current =
            loadSavedDescription && !!normalizeNovelHtml(next.description);
        lastAutoDescriptionRef.current = preserveSavedDescriptionRef.current
            ? next.description
            : null;
        setTemplateId('none');
        setDescriptionRevision(0);
        lastAppliedSignatureRef.current = null;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс только при смене товара
    }, [product.id, initialPurchaseFields?.supplierId]);

    useEffect(() => {
        if (!loadSavedDescription) return;
        if (!postTemplates?.length || userPickedTemplateRef.current) return;
        const defaultTemplate = resolveDefaultTemplateId(product.id, postTemplates);
        setTemplateId(defaultTemplate);
        if (defaultTemplate !== 'none') {
            persistTemplateChoice(product.id, defaultTemplate);
        }
    }, [product.id, postTemplates, loadSavedDescription]);

    const { data: attributeTypes, isSuccess: attributeTypesReady } = trpc.attributeTypes.list.useQuery();
    const { data: allAttributes } = trpc.productAttributes.list.useQuery();
    const { data: allCharacteristics } = trpc.characteristics.list.useQuery();
    const showInTitleByTypeId = useMemo(() => buildShowInTitleByTypeId(attributeTypes), [attributeTypes]);

    const characteristicsCatalog = useMemo(() => {
        if (!allAttributes?.length || !allCharacteristics?.length) return undefined;
        return { attributes: allAttributes, characteristics: allCharacteristics };
    }, [allAttributes, allCharacteristics]);

    const primarySupplierPack = useMemo(
        () => primarySupplierPackageFromTiers(supPkgTiers),
        [supPkgTiers],
    );

    const descriptionFields = useMemo(
        () => ({
            ...productToDescriptionFields(product, showInTitleByTypeId, attributeTypes, characteristicsCatalog),
            name: product.name,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
            priceTiers: tiers,
            supplierPackageTiers: supPkgTiers,
            supplierPackageAmount: primarySupplierPack.amount,
            supplierPackageUnit: primarySupplierPack.unit,
            supplierPackagePrice: primarySupplierPack.price,
            supplierLimit,
            supplierLimitUnit,
            supplierName: supplierName ?? undefined,
            purchaseTag,
            packDiscountPercent,
        }),
        [
            product,
            showInTitleByTypeId,
            attributeTypes,
            characteristicsCatalog,
            minPkgAmount,
            minPkgUnit,
            tiers,
            supPkgTiers,
            primarySupplierPack,
            supplierLimit,
            supplierLimitUnit,
            supplierName,
            purchaseTag,
            packDiscountPercent,
        ],
    );

    const descriptionFieldsRef = useRef(descriptionFields);
    descriptionFieldsRef.current = descriptionFields;

    const getTemplateBody = useCallback(
        (id: string) => {
            if (id === 'none') return null;
            return postTemplates?.find((t: { id: number; body: string }) => t.id === Number(id))?.body ?? null;
        },
        [postTemplates],
    );

    const selectedTemplateBody =
        templateId === 'none' ? '' : (getTemplateBody(templateId)?.trim() ?? '');

    const catalogReady = characteristicsCatalog != null;

    const syncDescriptionFromTemplate = useCallback(
        (id: string, options: { replace: boolean; bumpEditor: boolean }) => {
            if (id === 'none' || !attributeTypesReady || !catalogReady) return false;

            const body = getTemplateBody(id)?.trim();
            if (!body) return false;

            const nextHtml = applyPostTemplate(body, descriptionFieldsRef.current);

            if (preserveSavedDescriptionRef.current) {
                lastAppliedSignatureRef.current = `${id}:${body}`;
                preserveSavedDescriptionRef.current = false;
                return false;
            }

            const prevAuto = options.replace ? null : lastAutoDescriptionRef.current;
            setDescription((current) => mergeTemplateIntoDescription(current, prevAuto, nextHtml));
            lastAutoDescriptionRef.current = nextHtml;
            lastAppliedSignatureRef.current = `${id}:${body}`;

            if (options.bumpEditor) {
                setDescriptionRevision((n) => n + 1);
            }
            return true;
        },
        [attributeTypesReady, catalogReady, getTemplateBody],
    );

    useEffect(() => {
        if (templateId === 'none') {
            lastAppliedSignatureRef.current = null;
            lastAutoDescriptionRef.current = null;
            return;
        }
        if (!attributeTypesReady || !catalogReady || !selectedTemplateBody) return;

        const signature = `${templateId}:${selectedTemplateBody}`;
        const isNewTemplate = lastAppliedSignatureRef.current !== signature;

        syncDescriptionFromTemplate(templateId, {
            replace: isNewTemplate,
            bumpEditor: isNewTemplate,
        });
    }, [
        templateId,
        attributeTypesReady,
        catalogReady,
        selectedTemplateBody,
        descriptionFields,
        syncDescriptionFromTemplate,
    ]);

    function handleTemplateChange(value: string) {
        userPickedTemplateRef.current = true;
        preserveSavedDescriptionRef.current = false;
        lastAppliedSignatureRef.current = null;
        lastAutoDescriptionRef.current = null;
        setTemplateId(value);
        persistTemplateChoice(product.id, value);

        if (value === 'none') {
            setDescription(loadSavedDescription ? (initialPurchaseFields?.description ?? '') : '');
            lastAutoDescriptionRef.current = null;
            return;
        }

        syncDescriptionFromTemplate(value, { replace: true, bumpEditor: true });
    }

    function handleSave() {
        const tierError = validatePurchasePriceTiers(tiers);
        if (tierError) {
            setPriceError(tierError);
            toast.error(tierError);
            return;
        }
        setPriceError(null);

        const validTiers = tiers.filter((t) => t.amount > 0 && t.price > 0 && t.unit.trim());
        const firstTier = validTiers[0]!;
        const priceOverride = firstTier.price / firstTier.amount;
        const supplierPack = normalizeSupplierTiersForSave(supPkgTiers);

        onSave({
            supplierId,
            description: description || null,
            priceOverride,
            priceTiers: validTiers,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
            ...supplierPack,
            supplementStep,
            supplierLimit,
            supplierLimitUnit,
            targetRemainder,
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <TemplateSection
                templateId={templateId}
                postTemplates={postTemplates as { id: number; name: string }[] | undefined}
                onChange={handleTemplateChange}
            />
            <SupplierSection supplierId={supplierId} onChange={setSupplierId} />
            <MinPackageSection
                minPkgAmount={minPkgAmount}
                minPkgUnit={minPkgUnit}
                onAmountChange={setMinPkgAmount}
                onUnitChange={setMinPkgUnit}
            />
            <PriceTiersSection
                tiers={tiers}
                error={priceError}
                onChange={(next) => {
                    setTiers(next);
                    if (priceError && !validatePurchasePriceTiers(next)) {
                        setPriceError(null);
                    }
                }}
            />
            <SupplierPackageSection supPkgTiers={supPkgTiers} onChange={setSupPkgTiers} />
            <SupplementLimitsSection
                supplementStep={supplementStep}
                supplierLimit={supplierLimit}
                supplierLimitUnit={supplierLimitUnit}
                targetRemainder={targetRemainder}
                minPkgUnit={minPkgUnit}
                onSupplementStepChange={setSupplementStep}
                onSupplierLimitChange={setSupplierLimit}
                onSupplierLimitUnitChange={setSupplierLimitUnit}
                onMinPkgUnitChange={setMinPkgUnit}
                onTargetRemainderChange={setTargetRemainder}
            />
            <DescriptionSection
                productId={product.id}
                description={description}
                descriptionRevision={descriptionRevision}
                templateId={templateId}
                onChange={setDescription}
            />

            {footer}

            {/* Sticky footer */}
            <FormFooter>
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Отмена
                    </Button>
                )}
                <Button
                    type="button"
                    className="rounded-full"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving && <Loader2 className="size-4 animate-spin" />}
                    {submitLabel}
                </Button>
            </FormFooter>
        </div>
    );
}

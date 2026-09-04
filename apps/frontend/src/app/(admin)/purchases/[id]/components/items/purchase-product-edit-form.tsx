'use client';

import { resolveUnit } from '@zakupki/types';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { trpc } from '@/lib/client/trpc';
import { normalizeNovelHtml, postTemplateEngine, productDescriptionBuilder } from '@/lib/product-description';
import { buildShowInTitleByTypeId, type ProductLabelSource } from '@/lib/product-label';

import { getUnitPriceWithDeliveryRub } from '../../lib/items-table-pricing';
import { persistTemplateChoice, resolveDefaultTemplateId } from '../../lib/template-storage';
import type { PurchaseCurrencyRateRef } from '../../lib/types';
import { defaultUnitField } from '../../lib/unit-defaults';
import { gramsOrDefault, mergeTemplateIntoDescription, roundCurrency4, toNum } from './purchase-product-edit-form/form-utils';
import { DescriptionSection } from './purchase-product-edit-form/sections/description-section';
import {
    GRAM_DEFAULT_MIN_PACKAGE,
    GRAM_DEFAULT_SUPPLEMENT_STEP,
    GRAM_UNIT,
    PackPricingSection,
} from './purchase-product-edit-form/sections/pack-pricing-section';
import { SupplementLimitsSection } from './purchase-product-edit-form/sections/supplement-limits-section';
import { SupplierSection } from './purchase-product-edit-form/sections/supplier-section';

export type PurchaseProductSaveData = {
    supplierId?: number | null;
    description?: string | null;
    pricePerPackCurrency: number | null;
    currencyId: number | null;
    packAmount: number | null;
    packUnit: string | null;
    orgFeePercentOverride: number | null;
    deliveryPercentOverride: number | null;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string | null;
    targetRemainder: number | null;
    productUnitCode: 'gram' | 'piece' | 'tube';
};

interface PurchaseProductEditFormProps {
    product: ProductLabelSource & {
        id: number;
        unitCode: string;
    };
    initialPurchaseFields?: {
        supplierId?: number | null;
        description?: string | null;
        pricePerPackCurrency?: string | number | null;
        currencyId?: number | null;
        packAmount?: string | number | null;
        packUnit?: string | null;
        unitCode?: string | null;
        orgFeePercentOverride?: string | number | null;
        deliveryPercentOverride?: string | number | null;
        minPackageAmount?: string | number | null;
        minPackageUnit?: string | null;
        supplementStep?: string | number | null;
        supplierLimit?: string | number | null;
        supplierLimitUnit?: string | null;
        targetRemainder?: string | number | null;
    };
    onSave: (data: PurchaseProductSaveData) => void;
    onCancel?: () => void;
    isSaving: boolean;
    submitLabel?: string;
    footer?: React.ReactNode;
    purchaseTag?: string;
    currencyRates?: PurchaseCurrencyRateRef[];
    deliveryPercent?: number;
    loadSavedDescription?: boolean;
    hasOrders?: boolean;
}

export function PurchaseProductEditForm({
    product,
    initialPurchaseFields,
    onSave,
    onCancel,
    isSaving,
    submitLabel = 'Сохранить',
    footer,
    purchaseTag,
    currencyRates,
    deliveryPercent = 0,
    loadSavedDescription = false,
    hasOrders = false,
}: PurchaseProductEditFormProps) {
    const f = initialPurchaseFields ?? {};

    const initialUnitDef = resolveUnit(f.unitCode) ?? resolveUnit(f.packUnit) ?? resolveUnit(product.unitCode);
    const initialUnit = initialUnitDef?.shortName ?? GRAM_UNIT;
    const initialIsWeight = initialUnitDef?.kind === 'WEIGHT';
    const savedPackAmount = toNum(f.packAmount);
    const savedPrice = toNum(f.pricePerPackCurrency);
    const legacyPiecePack = !initialIsWeight && savedPackAmount != null && savedPackAmount > 1;
    const legacyPriceNote = legacyPiecePack && savedPrice != null
        ? `Цена пересчитана за 1 ${initialUnit} из цены упаковки (${savedPackAmount} ${initialUnit})`
        : null;

    const [unit, setUnit] = useState(initialUnit);
    const [priceNote, setPriceNote] = useState<string | null>(legacyPriceNote);
    const [pricePerPackCurrency, setPricePerPackCurrency] = useState<number | null>(
        legacyPiecePack && savedPrice != null ? roundCurrency4(savedPrice / (savedPackAmount ?? 1)) : savedPrice,
    );
    const [currencyId, setCurrencyId] = useState<number | null>(f.currencyId ?? null);
    const [packAmount, setPackAmount] = useState<number | null>(initialIsWeight ? savedPackAmount : 1);
    const isWeight = resolveUnit(unit)?.kind === 'WEIGHT';
    const [orgFeePercentOverride, setOrgFeePercentOverride] = useState<number | null>(toNum(f.orgFeePercentOverride));
    const [deliveryPercentOverride, setDeliveryPercentOverride] = useState<number | null>(
        toNum(f.deliveryPercentOverride),
    );
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(
        gramsOrDefault(f.minPackageAmount, initialUnit, GRAM_DEFAULT_MIN_PACKAGE),
    );
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(defaultUnitField(f.minPackageUnit, initialUnit));
    const [supplementStep, setSupplementStep] = useState<number | null>(
        gramsOrDefault(f.supplementStep, initialUnit, GRAM_DEFAULT_SUPPLEMENT_STEP),
    );
    const [supplierLimit, setSupplierLimit] = useState<number | null>(toNum(f.supplierLimit));
    const [supplierLimitUnit, setSupplierLimitUnit] = useState<string | null>(
        defaultUnitField(f.supplierLimitUnit, initialUnit),
    );
    const [targetRemainder, setTargetRemainder] = useState<number | null>(toNum(f.targetRemainder));
    const [supplierId, setSupplierId] = useState<number | null>(f.supplierId ?? null);
    const [description, setDescription] = useState(f.description ?? '');
    const [templateId, setTemplateId] = useState('none');
    const [descriptionRevision, setDescriptionRevision] = useState(0);

    const gramPackAmountRef = useRef<number | null>(initialIsWeight ? savedPackAmount : null);
    const initialUnitRef = useRef(initialUnit);

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();
    const { data: suppliers } = trpc.suppliers.list.useQuery();
    const { data: currencies } = trpc.currencies.list.useQuery();
    const { orgFeeDefaultPercent } = usePricingSettings();

    const supplierName = useMemo(() => {
        if (supplierId == null) return null;
        return (suppliers ?? []).find((s) => s.id === supplierId)?.name ?? null;
    }, [supplierId, suppliers]);

    const currencyName = useMemo(() => {
        if (currencyId == null) return null;
        return (currencies ?? []).find((c) => c.id === currencyId)?.name ?? null;
    }, [currencyId, currencies]);

    const unitPriceRub = useMemo(
        () =>
            getUnitPriceWithDeliveryRub(
                { pricePerPackCurrency, currencyId, packAmount, orgFeePercentOverride, deliveryPercentOverride },
                currencyRates ?? [],
                orgFeeDefaultPercent,
                deliveryPercent,
            ),
        [
            pricePerPackCurrency,
            currencyId,
            packAmount,
            orgFeePercentOverride,
            deliveryPercentOverride,
            currencyRates,
            orgFeeDefaultPercent,
            deliveryPercent,
        ],
    );


    useEffect(() => {
        if (currencyId != null) return;
        if (!currencies?.length) return;
        const eur = currencies.find((c) => c.code?.toUpperCase() === 'EUR');
        const nonRub = currencies.find((c) => c.code?.toUpperCase() !== 'RUB');
        const target = eur ?? nonRub ?? currencies[0];
        if (target) setCurrencyId(target.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- авто-дефолт по загрузке списка
    }, [currencies]);

    const userPickedTemplateRef = useRef(false);
    const lastAppliedSignatureRef = useRef<string | null>(null);
    const lastAutoDescriptionRef = useRef<string | null>(
        loadSavedDescription && !!normalizeNovelHtml(f.description ?? '') ? (f.description ?? '') : null,
    );
    const preserveSavedDescriptionRef = useRef(loadSavedDescription && !!normalizeNovelHtml(f.description ?? ''));

    useEffect(() => {
        const nextF = initialPurchaseFields ?? {};
        const nextUnitDef =
            resolveUnit(nextF.unitCode) ?? resolveUnit(nextF.packUnit) ?? resolveUnit(product.unitCode);
        const nextUnit = nextUnitDef?.shortName ?? GRAM_UNIT;
        const nextIsWeight = nextUnitDef?.kind === 'WEIGHT';
        const nextSavedPack = toNum(nextF.packAmount);
        const nextSavedPrice = toNum(nextF.pricePerPackCurrency);
        const nextLegacyPack = !nextIsWeight && nextSavedPack != null && nextSavedPack > 1;

        setUnit(nextUnit);
        setPriceNote(
            nextLegacyPack && nextSavedPrice != null
                ? `Цена пересчитана за 1 ${nextUnit} из цены упаковки (${nextSavedPack} ${nextUnit})`
                : null,
        );
        setPricePerPackCurrency(
            nextLegacyPack && nextSavedPrice != null ? roundCurrency4(nextSavedPrice / (nextSavedPack ?? 1)) : nextSavedPrice,
        );
        setCurrencyId(nextF.currencyId ?? null);
        setPackAmount(nextIsWeight ? nextSavedPack : 1);
        setOrgFeePercentOverride(toNum(nextF.orgFeePercentOverride));
        setDeliveryPercentOverride(toNum(nextF.deliveryPercentOverride));
        setMinPkgAmount(gramsOrDefault(nextF.minPackageAmount, nextUnit, GRAM_DEFAULT_MIN_PACKAGE));
        setMinPkgUnit(defaultUnitField(nextF.minPackageUnit, nextUnit));
        setSupplementStep(gramsOrDefault(nextF.supplementStep, nextUnit, GRAM_DEFAULT_SUPPLEMENT_STEP));
        setSupplierLimit(toNum(nextF.supplierLimit));
        setSupplierLimitUnit(defaultUnitField(nextF.supplierLimitUnit, nextUnit));
        setTargetRemainder(toNum(nextF.targetRemainder));
        setSupplierId(nextF.supplierId ?? null);
        setDescription(nextF.description ?? '');

        gramPackAmountRef.current = nextIsWeight ? nextSavedPack : null;
        initialUnitRef.current = nextUnit;
        userPickedTemplateRef.current = false;
        preserveSavedDescriptionRef.current = loadSavedDescription && !!normalizeNovelHtml(nextF.description ?? '');
        lastAutoDescriptionRef.current = preserveSavedDescriptionRef.current ? (nextF.description ?? '') : null;
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

    const descriptionFields = useMemo(
        () => ({
            ...productDescriptionBuilder.fromProduct(
                product,
                showInTitleByTypeId,
                attributeTypes,
                characteristicsCatalog,
            ),
            name: product.name,
            pricePerPackCurrency,
            currencyName: currencyName ?? undefined,
            packAmount: isWeight ? packAmount : null,
            packUnit: unit,
            supplierName: supplierName ?? undefined,
            purchaseTag,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit ?? undefined,
            unitPriceRub,
        }),
        [
            product,
            showInTitleByTypeId,
            attributeTypes,
            characteristicsCatalog,
            pricePerPackCurrency,
            currencyName,
            packAmount,
            unit,
            isWeight,
            supplierName,
            purchaseTag,
            minPkgAmount,
            minPkgUnit,
            unitPriceRub,
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

    const selectedTemplateBody = templateId === 'none' ? '' : (getTemplateBody(templateId)?.trim() ?? '');

    const catalogReady = characteristicsCatalog != null;

    const syncDescriptionFromTemplate = useCallback(
        (id: string, options: { replace: boolean; bumpEditor: boolean }) => {
            if (id === 'none' || !attributeTypesReady || !catalogReady) return false;

            const body = getTemplateBody(id)?.trim();
            if (!body) return false;

            const nextHtml = postTemplateEngine.apply(body, descriptionFieldsRef.current);

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

    function handleUnitChange(next: string) {
        const nextIsWeight = resolveUnit(next)?.kind === 'WEIGHT';
        if (nextIsWeight) {
            setPackAmount(gramPackAmountRef.current);
        } else {
            if (isWeight) gramPackAmountRef.current = packAmount;
            setPackAmount(1);
            setMinPkgAmount(null);
            setSupplementStep(null);
        }
        setUnit(next);
    }

    function handleSave() {
        onSave({
            supplierId,
            description: description || null,
            pricePerPackCurrency,
            currencyId,
            packAmount: isWeight ? packAmount : 1,
            packUnit: unit,
            orgFeePercentOverride,
            deliveryPercentOverride,
            minPackageAmount: isWeight ? minPkgAmount : null,
            minPackageUnit: isWeight ? minPkgUnit : unit,
            supplementStep: isWeight ? supplementStep : null,
            supplierLimit,
            supplierLimitUnit: isWeight ? supplierLimitUnit : unit,
            targetRemainder,
            productUnitCode: (resolveUnit(unit)?.code ?? product.unitCode) as 'gram' | 'piece' | 'tube',
        });
    }

    const unitWarning =
        hasOrders && unit !== initialUnitRef.current
            ? 'У позиции уже есть заказы — смена единицы не пересчитает их количества'
            : null;

    return (
        <div className="flex flex-col gap-4">
            <SupplierSection supplierId={supplierId} onChange={setSupplierId} />
            <PackPricingSection
                unit={unit}
                onUnitChange={handleUnitChange}
                pricePerPackCurrency={pricePerPackCurrency}
                currencyId={currencyId}
                packAmount={packAmount}
                orgFeePercentOverride={orgFeePercentOverride}
                orgFeeDefaultPercent={orgFeeDefaultPercent}
                deliveryPercent={deliveryPercent}
                deliveryPercentOverride={deliveryPercentOverride}
                currencyRates={currencyRates}
                currencies={(currencies ?? []).map((c) => ({
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    symbol: c.symbol,
                }))}
                onPriceChange={setPricePerPackCurrency}
                onCurrencyChange={setCurrencyId}
                onPackAmountChange={setPackAmount}
                onOrgFeeChange={setOrgFeePercentOverride}
                onDeliveryPercentChange={setDeliveryPercentOverride}
                unitWarning={unitWarning}
                priceNote={priceNote}
                onGramsSelected={() => {
                    setMinPkgAmount(GRAM_DEFAULT_MIN_PACKAGE);
                    setMinPkgUnit(GRAM_UNIT);
                    setSupplementStep(GRAM_DEFAULT_SUPPLEMENT_STEP);
                }}
            />
            <SupplementLimitsSection
                unit={unit}
                minPackageAmount={minPkgAmount}
                supplementStep={supplementStep}
                supplierLimit={supplierLimit}
                supplierLimitUnit={supplierLimitUnit}
                targetRemainder={targetRemainder}
                minPkgUnit={minPkgUnit}
                onMinPackageAmountChange={setMinPkgAmount}
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
                postTemplates={postTemplates as { id: number; name: string }[] | undefined}
                onTemplateChange={handleTemplateChange}
                onChange={setDescription}
            />

            {footer}

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
                <Button type="button" className="rounded-full" onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="size-4 animate-spin" />}
                    {submitLabel}
                </Button>
            </FormFooter>
        </div>
    );
}

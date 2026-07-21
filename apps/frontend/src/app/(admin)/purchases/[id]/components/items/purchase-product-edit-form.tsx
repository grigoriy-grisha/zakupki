'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getUnitByCode } from '@zakupki/types';

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

import { persistTemplateChoice, resolveDefaultTemplateId } from '../../lib/template-storage';
import { defaultUnitField } from '../../lib/unit-defaults';
import { DescriptionSection } from './purchase-product-edit-form/sections/description-section';
import { PackPricingSection } from './purchase-product-edit-form/sections/pack-pricing-section';
import { SupplementLimitsSection } from './purchase-product-edit-form/sections/supplement-limits-section';
import { SupplierSection } from './purchase-product-edit-form/sections/supplier-section';
import { TemplateSection } from './purchase-product-edit-form/sections/template-section';

/**
 * Данные формы при сохранении — новая модель цен + добор/лимиты + описание.
 * Старая tier-модель (priceTiers, supplierPackage*, priceOverride) убрана.
 */
export type PurchaseProductSaveData = {
    supplierId?: number | null;
    description?: string | null;
    // Новая модель цен:
    pricePerPackCurrency: number | null;
    currencyId: number | null;
    packAmount: number | null;
    packUnit: string | null;
    orgFeePercentOverride: number | null;
    // Добор и лимиты (+ minPackage используется внутри секции):
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string | null;
    targetRemainder: number | null;
};

interface PurchaseProductEditFormProps {
    product: ProductLabelSource & {
        id: number;
        /** Плоский код единицы (gram | piece | tube), как в Product.unitCode. */
        unitCode: string;
    };
    /** Per-purchase поля (если форма используется для редактирования существующего PurchaseItem). */
    initialPurchaseFields?: {
        supplierId?: number | null;
        description?: string | null;
        // Новая модель цен:
        pricePerPackCurrency?: string | number | null;
        currencyId?: number | null;
        packAmount?: string | number | null;
        packUnit?: string | null;
        orgFeePercentOverride?: string | number | null;
        // Добор и лимиты:
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

/** Нормализация Decimal/строки в number | null. */
function toNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
 * Форма редактирования/создания товара в закупке — упрощённая модель цен.
 *
 * Секции:
 *  1. Шаблон поста
 *  2. Поставщик (опц.)
 *  3. Цена за упаковку (валюта + вес + оргсбор) — новая модель
 *  4. Добор и лимиты
 *  5. Описание (NovelEditor)
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
    const f = initialPurchaseFields ?? {};

    // Новая модель цен:
    const [pricePerPackCurrency, setPricePerPackCurrency] = useState<number | null>(
        toNum(f.pricePerPackCurrency),
    );
    const [currencyId, setCurrencyId] = useState<number | null>(f.currencyId ?? null);
    const [packAmount, setPackAmount] = useState<number | null>(toNum(f.packAmount));
    // Дефолт единицы для всех трёх unit-полей: сохранённое значение → unit товара → null.
    const [packUnit, setPackUnit] = useState<string | null>(
        defaultUnitField(f.packUnit, getUnitByCode(product.unitCode)?.shortName),
    );
    const [orgFeePercentOverride, setOrgFeePercentOverride] = useState<number | null>(
        toNum(f.orgFeePercentOverride),
    );
    // Добор и лимиты:
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(toNum(f.minPackageAmount));
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(
        defaultUnitField(f.minPackageUnit, getUnitByCode(product.unitCode)?.shortName),
    );
    const [supplementStep, setSupplementStep] = useState<number | null>(toNum(f.supplementStep));
    const [supplierLimit, setSupplierLimit] = useState<number | null>(toNum(f.supplierLimit));
    const [supplierLimitUnit, setSupplierLimitUnit] = useState<string | null>(
        defaultUnitField(f.supplierLimitUnit, getUnitByCode(product.unitCode)?.shortName),
    );
    const [targetRemainder, setTargetRemainder] = useState<number | null>(toNum(f.targetRemainder));
    // Прочее:
    const [supplierId, setSupplierId] = useState<number | null>(f.supplierId ?? null);
    const [description, setDescription] = useState(f.description ?? '');
    const [templateId, setTemplateId] = useState('none');
    const [descriptionRevision, setDescriptionRevision] = useState(0);

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

    // По умолчанию выбираем валюту поставщика (EUR), а не рубль.
    // Срабатывает только если валюта не задана и список валют загружен.
    // Приоритет: EUR → первая не-RUB → первая в списке.
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
        loadSavedDescription && !!normalizeNovelHtml(f.description ?? '')
            ? f.description ?? ''
            : null,
    );
    const preserveSavedDescriptionRef = useRef(
        loadSavedDescription && !!normalizeNovelHtml(f.description ?? ''),
    );

    // Сброс при смене товара.
    useEffect(() => {
        const nextF = initialPurchaseFields ?? {};
        setPricePerPackCurrency(toNum(nextF.pricePerPackCurrency));
        setCurrencyId(nextF.currencyId ?? null);
        setPackAmount(toNum(nextF.packAmount));
        setPackUnit(defaultUnitField(nextF.packUnit, getUnitByCode(product.unitCode)?.shortName));
        setOrgFeePercentOverride(toNum(nextF.orgFeePercentOverride));
        setMinPkgAmount(toNum(nextF.minPackageAmount));
        setMinPkgUnit(defaultUnitField(nextF.minPackageUnit, getUnitByCode(product.unitCode)?.shortName));
        setSupplementStep(toNum(nextF.supplementStep));
        setSupplierLimit(toNum(nextF.supplierLimit));
        setSupplierLimitUnit(defaultUnitField(nextF.supplierLimitUnit, getUnitByCode(product.unitCode)?.shortName));
        setTargetRemainder(toNum(nextF.targetRemainder));
        setSupplierId(nextF.supplierId ?? null);
        setDescription(nextF.description ?? '');

        userPickedTemplateRef.current = false;
        preserveSavedDescriptionRef.current =
            loadSavedDescription && !!normalizeNovelHtml(nextF.description ?? '');
        lastAutoDescriptionRef.current = preserveSavedDescriptionRef.current
            ? nextF.description ?? ''
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

    const descriptionFields = useMemo(
        () => ({
            ...productToDescriptionFields(product, showInTitleByTypeId, attributeTypes, characteristicsCatalog),
            name: product.name,
            // Новая модель цен для шаблона:
            pricePerPackCurrency,
            currencyName: currencyName ?? undefined,
            packAmount,
            packUnit,
            supplierName: supplierName ?? undefined,
            purchaseTag,
        }),
        [
            product,
            showInTitleByTypeId,
            attributeTypes,
            characteristicsCatalog,
            pricePerPackCurrency,
            currencyName,
            packAmount,
            packUnit,
            supplierName,
            purchaseTag,
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
        onSave({
            supplierId,
            description: description || null,
            pricePerPackCurrency,
            currencyId,
            packAmount,
            packUnit,
            orgFeePercentOverride,
            minPackageAmount: minPkgAmount,
            minPackageUnit: minPkgUnit,
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
            <PackPricingSection
                pricePerPackCurrency={pricePerPackCurrency}
                currencyId={currencyId}
                packAmount={packAmount}
                packUnit={packUnit}
                orgFeePercentOverride={orgFeePercentOverride}
                orgFeeDefaultPercent={orgFeeDefaultPercent}
                currencies={(currencies ?? []).map((c) => ({
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    symbol: c.symbol,
                }))}
                onPriceChange={setPricePerPackCurrency}
                onCurrencyChange={setCurrencyId}
                onPackAmountChange={setPackAmount}
                onPackUnitChange={setPackUnit}
                onOrgFeeChange={setOrgFeePercentOverride}
            />
            <SupplementLimitsSection
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

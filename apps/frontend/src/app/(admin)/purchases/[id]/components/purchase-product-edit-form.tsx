'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { FormField } from '@/components/ui/form-field';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { Button as UIButton } from '@/components/ui/button';

import { PriceTierEditor, PackageEditor } from '../../../products/components/package-fields';
import { PackageUnitSelect } from '../../../products/components/package-unit-select';
import {
    PACKAGE_UNITS,
    applyPostTemplate,
    buildShowInTitleByTypeId,
    normalizeNovelHtml,
    productToDescriptionFields,
    type ProductLabelSource,
} from '../../../products/lib';

import {
    buildPurchaseFormState,
    normalizeSupplierTiersForSave,
    persistTemplateChoice,
    primarySupplierPackageFromTiers,
    resolveDefaultTemplateId,
    validatePurchasePriceTiers,
} from '../lib/purchase-product-fields';

export type PurchaseProductSaveData = {
    description?: string;
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
        description?: string | null;
        priceTiers?: unknown;
        unit?: { shortName?: string | null; name?: string | null } | null;
    };
    initialTiers: { amount: number; unit: string; price: number }[];
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
 *  2. Мин. фасовка
 *  3. Цены (тиры)
 *  4. Фасовка поставщика
 *  5. Добор и лимиты (supplementStep + supplierLimit + targetRemainder)
 *  6. Описание (NovelEditor)
 *
 * Sticky footer с [Отмена] [Сохранить].
 */
export function PurchaseProductEditForm({
    product,
    initialTiers,
    onSave,
    onCancel,
    isSaving,
    submitLabel = 'Сохранить',
    footer,
    purchaseTag,
    loadSavedDescription = false,
}: PurchaseProductEditFormProps) {
    const initial = buildPurchaseFormState(product, initialTiers, loadSavedDescription);

    const [description, setDescription] = useState(initial.description);
    const [tiers, setTiers] = useState(initial.tiers);
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(initial.minPkgAmount);
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(initial.minPkgUnit);
    const [supPkgTiers, setSupPkgTiers] = useState(initial.supPkgTiers);
    const [supplementStep, setSupplementStep] = useState<number | null>(initial.supplementStep);
    const [supplierLimit, setSupplierLimit] = useState<number | null>(initial.supplierLimit);
    const [supplierLimitUnit, setSupplierLimitUnit] = useState<string | null>(initial.supplierLimitUnit);
    const [targetRemainder, setTargetRemainder] = useState<number | null>(initial.targetRemainder);
    const [templateId, setTemplateId] = useState('none');
    const [descriptionRevision, setDescriptionRevision] = useState(0);
    const [priceError, setPriceError] = useState<string | null>(null);

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

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
        const next = buildPurchaseFormState(product, initialTiers, loadSavedDescription);
        setDescription(next.description);
        setTiers(next.tiers);
        setMinPkgAmount(next.minPkgAmount);
        setMinPkgUnit(next.minPkgUnit);
        setSupPkgTiers(next.supPkgTiers);
        setSupplementStep(next.supplementStep);
        setSupplierLimit(next.supplierLimit);
        setSupplierLimitUnit(next.supplierLimitUnit);
        setTargetRemainder(next.targetRemainder);

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
    }, [product.id]);

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
            setDescription(loadSavedDescription ? (product.description ?? '') : '');
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
            description: description || undefined,
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
            {/* === 1. Шаблон поста === */}
            <FormSection
                title="Шаблон поста"
                description="Выберите шаблон, чтобы автоматически заполнить описание"
            >
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
            </FormSection>

            {/* === 2. Мин. фасовка === */}
            <FormSection card title="Минимальная фасовка">
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        step="1"
                        min={0}
                        inputMode="numeric"
                        className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                        value={minPkgAmount != null ? String(Math.trunc(minPkgAmount)) : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            setMinPkgAmount(raw === '' ? null : Number.parseInt(raw, 10) || 0);
                        }}
                        aria-label="Минимальная фасовка"
                    />
                    <PackageUnitSelect
                        value={minPkgUnit ?? PACKAGE_UNITS[0]}
                        onChange={setMinPkgUnit}
                    />
                </div>
                <p className="text-12-regular text-fg-tertiary">
                    Шаг +/− на этапе сбора. Например: 5 гр — заказ кратен 5.
                </p>
            </FormSection>

            {/* === 3. Цены (тиры) === */}
            <FormSection
                card
                title="Цены"
                description="Сколько стоит указанное количество единиц"
            >
                <PriceTierEditor
                    tiers={tiers}
                    addTierLabel="Добавить цену"
                    onChange={(next) => {
                        setTiers(next);
                        if (priceError && !validatePurchasePriceTiers(next)) {
                            setPriceError(null);
                        }
                    }}
                    error={priceError}
                />
            </FormSection>

            {/* === 4. Фасовка поставщика === */}
            <FormSection
                card
                title="Фасовка поставщика"
                description="Целая пачка от поставщика — можно заказать +1 упаковку"
            >
                <PriceTierEditor
                    tiers={supPkgTiers}
                    required={false}
                    label=""
                    addTierLabel="Добавить фасовку"
                    onChange={setSupPkgTiers}
                />
            </FormSection>

            {/* === 5. Добор и лимиты === */}
            <FormSection card title="Добор и лимиты">
                <FormField
                    label="Шаг добора"
                    hint="Шаг +/− на этапе добора. Если не задан — используется мин. фасовка"
                >
                    <div className="flex items-center gap-2">
                        <Input
                            id="supplementStep"
                            type="number"
                            step="0.001"
                            min={0}
                            placeholder="По умолчанию (мин. фасовка)"
                            className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                            value={supplementStep != null ? String(supplementStep) : ''}
                            onChange={(e) =>
                                setSupplementStep(e.target.value === '' ? null : Number(e.target.value))
                            }
                        />
                        <PackageUnitSelect
                            value={minPkgUnit ?? PACKAGE_UNITS[0]}
                            onChange={setMinPkgUnit}
                        />
                    </div>
                </FormField>

                <PackageEditor
                    label="Лимит у поставщика (на всех покупателей)"
                    amount={supplierLimit}
                    unit={supplierLimitUnit ?? PACKAGE_UNITS[0]}
                    onAmountChange={setSupplierLimit}
                    onUnitChange={setSupplierLimitUnit}
                    description="Суммарно все покупатели не могут заказать больше этого количества ни на одном этапе. Если не задан — без ограничений."
                />

                <FormField
                    label="Целевой остаток (добор)"
                    hint="Сколько ещё нужно добрать у поставщика на этапе REORDER. Оставьте пустым, если добор не нужен."
                >
                    <Input
                        id="targetRemainder"
                        type="number"
                        step="0.001"
                        min={0}
                        placeholder="0"
                        className="h-9 w-32 rounded-xl text-13-medium tabular-nums"
                        value={targetRemainder != null ? String(targetRemainder) : ''}
                        onChange={(e) =>
                            setTargetRemainder(e.target.value === '' ? null : Number(e.target.value))
                        }
                    />
                </FormField>
            </FormSection>

            {/* === 6. Описание === */}
            <FormSection
                title="Описание"
                description={
                    templateId === 'none'
                        ? 'Текст для поста — можно заполнить вручную'
                        : 'Сгенерировано из шаблона — можно отредактировать'
                }
            >
                <div className="max-h-[40vh] overflow-y-auto rounded-2xl border border-border bg-bg-base p-2">
                    <NovelEditor
                        key={`purchase-desc-${product.id}-${descriptionRevision}`}
                        value={description}
                        onChange={setDescription}
                        placeholder={
                            templateId === 'none'
                                ? 'Текст описания для поста…'
                                : 'Текст из шаблона — можно дописать своё…'
                        }
                    />
                </div>
            </FormSection>

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

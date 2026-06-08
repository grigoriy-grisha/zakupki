'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/client/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NovelEditor } from '@/components/ui/novel-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import {
    buildPurchaseFormState,
    normalizeSupplierTiersForSave,
    persistTemplateChoice,
    primarySupplierPackageFromTiers,
    resolveDefaultTemplateId,
    validatePurchasePriceTiers,
    type PurchaseProductFormState,
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
    referenceStock: number | null;
    referenceStockUnit: string | null;
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
        referenceStock?: string | number | null;
        referenceStockUnit?: string | null;
        description?: string | null;
        priceTiers?: unknown;
        unit?: { shortName?: string | null; name?: string | null } | null;
    };
    initialTiers: { amount: number; unit: string; price: number }[];
    onSave: (data: PurchaseProductSaveData) => void;
    isSaving: boolean;
    submitLabel?: string;
    footer?: React.ReactNode;
    purchaseTag?: string;
    loadSavedDescription?: boolean;
}

function applyPurchaseFields(
    setters: {
        setDescription: (v: string) => void;
        setTiers: (v: PurchaseProductFormState['tiers']) => void;
        setMinPkgAmount: (v: number | null) => void;
        setMinPkgUnit: (v: string | null) => void;
        setSupPkgTiers: (v: PurchaseProductFormState['supPkgTiers']) => void;
        setSupplementStep: (v: number | null) => void;
        setReferenceStock: (v: number | null) => void;
        setReferenceStockUnit: (v: string | null) => void;
    },
    next: PurchaseProductFormState,
) {
    setters.setDescription(next.description);
    setters.setTiers(next.tiers);
    setters.setMinPkgAmount(next.minPkgAmount);
    setters.setMinPkgUnit(next.minPkgUnit);
    setters.setSupPkgTiers(next.supPkgTiers);
    setters.setSupplementStep(next.supplementStep);
    setters.setReferenceStock(next.referenceStock);
    setters.setReferenceStockUnit(next.referenceStockUnit);
}

function mergeTemplateIntoDescription(current: string, prevAuto: string | null, nextAuto: string): string {
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
    const initial = buildPurchaseFormState(product, initialTiers, loadSavedDescription);

    const [description, setDescription] = useState(initial.description);
    const [tiers, setTiers] = useState(initial.tiers);
    const [minPkgAmount, setMinPkgAmount] = useState<number | null>(initial.minPkgAmount);
    const [minPkgUnit, setMinPkgUnit] = useState<string | null>(initial.minPkgUnit);
    const [supPkgTiers, setSupPkgTiers] = useState(initial.supPkgTiers);
    const [supplementStep, setSupplementStep] = useState<number | null>(initial.supplementStep);
    const [referenceStock, setReferenceStock] = useState<number | null>(initial.referenceStock);
    const [referenceStockUnit, setReferenceStockUnit] = useState<string | null>(initial.referenceStockUnit);
    const [templateId, setTemplateId] = useState('none');
    const [descriptionRevision, setDescriptionRevision] = useState(0);
    const [priceError, setPriceError] = useState<string | null>(null);

    const { data: postTemplates } = trpc.postTemplates.list.useQuery();
    const { beadPackPriceDiscountPercent: packDiscountPercent } = usePricingSettings();

    const userPickedTemplateRef = useRef(false);
    const lastAppliedSignatureRef = useRef<string | null>(null);
    /** Если загружено сохранённое описание — считаем его «последним автотекстом»,
     *  чтобы mergeTemplateIntoDescription корректно отслеживал изменения полей. */
    const lastAutoDescriptionRef = useRef<string | null>(
        loadSavedDescription && !!normalizeNovelHtml(initial.description) ? initial.description : null,
    );
    /** При редактировании: не затирать уже сохранённое описание при автовыборе шаблона. */
    const preserveSavedDescriptionRef = useRef(loadSavedDescription && !!normalizeNovelHtml(initial.description));

    useEffect(() => {
        const next = buildPurchaseFormState(product, initialTiers, loadSavedDescription);
        applyPurchaseFields(
            {
                setDescription,
                setTiers,
                setMinPkgAmount,
                setMinPkgUnit,
                setSupPkgTiers,
                setSupplementStep,
                setReferenceStock,
                setReferenceStockUnit,
            },
            next,
        );
        userPickedTemplateRef.current = false;
        preserveSavedDescriptionRef.current = loadSavedDescription && !!normalizeNovelHtml(next.description);
        lastAutoDescriptionRef.current = preserveSavedDescriptionRef.current ? next.description : null;
        setTemplateId('none');
        setDescriptionRevision(0);
        lastAppliedSignatureRef.current = null;
        // eslint-disable-next-line react-hooks/exhaustive-deps — сброс только при смене товара
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

    const primarySupplierPack = useMemo(() => primarySupplierPackageFromTiers(supPkgTiers), [supPkgTiers]);

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
            referenceStock: referenceStock,
            referenceStockUnit: referenceStockUnit,
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
            referenceStock,
            referenceStockUnit,
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

    const selectedTemplateBody = templateId === 'none' ? '' : (getTemplateBody(templateId)?.trim() ?? '');

    const catalogReady = characteristicsCatalog != null;

    const syncDescriptionFromTemplate = useCallback(
        (id: string, options: { replace: boolean; bumpEditor: boolean }) => {
            if (id === 'none' || !attributeTypesReady || !catalogReady) return false;

            const body = getTemplateBody(id)?.trim();
            if (!body) return false;

            const nextHtml = applyPostTemplate(body, descriptionFieldsRef.current);

            if (preserveSavedDescriptionRef.current) {
                lastAppliedSignatureRef.current = `${id}:${body}`;
                // Не затираем lastAutoDescriptionRef — он уже указывает на сохранённое описание,
                // чтобы mergeTemplateIntoDescription корректно обновлял описание при смене полей.
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
            referenceStock: referenceStock,
            referenceStockUnit: referenceStockUnit,
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
                        step="1"
                        min={0}
                        inputMode="numeric"
                        className="flex-1"
                        value={minPkgAmount != null ? String(Math.trunc(minPkgAmount)) : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            setMinPkgAmount(raw === '' ? null : Number.parseInt(raw, 10) || 0);
                        }}
                    />
                    <PackageUnitSelect value={minPkgUnit ?? PACKAGE_UNITS[0]} onChange={setMinPkgUnit} />
                </div>
            </div>

            <div className="space-y-1">
                <PriceTierEditor
                    tiers={tiers}
                    onChange={(next) => {
                        setTiers(next);
                        if (priceError && !validatePurchasePriceTiers(next)) {
                            setPriceError(null);
                        }
                    }}
                />
                {priceError && <p className="text-xs text-destructive">{priceError}</p>}
            </div>

            <PriceTierEditor
                label="Фасовка поставщика"
                required={false}
                tiers={supPkgTiers}
                onChange={setSupPkgTiers}
            />

            <div className="space-y-1">
                <Label htmlFor="supplementStep">Фасовка для добора</Label>
                <Input
                    id="supplementStep"
                    type="number"
                    step="0.001"
                    min={0}
                    placeholder="По умолчанию (мин. фасовка)"
                    value={supplementStep != null ? String(supplementStep) : ''}
                    onChange={(e) => setSupplementStep(e.target.value === '' ? null : Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                    Шаг +/− на этапе добора. Если не задан — используется мин. фасовка.
                </p>
            </div>

            <div className="space-y-1">
                <PackageEditor
                    label="У поставщика (для поста)"
                    amount={referenceStock}
                    unit={referenceStockUnit ?? PACKAGE_UNITS[0]}
                    onAmountChange={setReferenceStock}
                    onUnitChange={setReferenceStockUnit}
                />
                <p className="text-xs text-muted-foreground">
                    Справочное поле для поста в Telegram («СВОБОДНО: 45 гр»).{' '}
                    <span className="font-medium text-foreground">
                        Это не лимит дозаказа
                    </span>{' '}
                    — лимит задаётся отдельно кнопкой «Остатки для добора» на странице закупки.
                </p>
            </div>

            <div className="space-y-1">
                <Label>Описание</Label>
                <div className="max-h-[35vh] overflow-y-auto rounded-md border">
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
            </div>

            {footer}

            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
            </Button>
        </div>
    );
}

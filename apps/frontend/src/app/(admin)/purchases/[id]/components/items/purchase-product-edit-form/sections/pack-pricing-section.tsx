'use client';

import {
    computePackPriceWithOrgFee,
    resolveCurrencyRate,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
    resolveUnit,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from '@zakupki/types';

import { PackageUnitSelect } from '@/components/shared/package-unit-select';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
    formatUnitRub,
    formatWholeRub,
    getPackPriceRub,
    getPackPriceWithOrgFeeRub,
    getUnitPriceWithDeliveryRub,
} from '../../../../lib/items-table-pricing';
import type { PurchaseCurrencyRateRef } from '../../../../lib/types';
import { InlineCell } from '../../inline-cell';

export const GRAM_DEFAULT_MIN_PACKAGE = 5;
export const GRAM_DEFAULT_SUPPLEMENT_STEP = 10;
export const GRAM_UNIT = 'гр';

const PIECE_SECTION_TITLES: Record<string, string> = {
    шт: 'Цена за штуку',
    туба: 'Цена за тубу',
};

interface CurrencyRow {
    id: number;
    name: string;
    code: string | null;
    symbol: string | null;
}

interface PackPricingSectionProps {
    unit: string;
    onUnitChange: (value: string) => void;
    pricePerPackCurrency: number | null;
    currencyId: number | null;
    packAmount: number | null;
    orgFeePercentOverride: number | null;
    orgFeeDefaultPercent: number;
    deliveryPercent: number;
    deliveryPercentOverride: number | null;
    currencies: CurrencyRow[];
    currencyRates?: PurchaseCurrencyRateRef[];
    onPriceChange: (value: number | null) => void;
    onCurrencyChange: (value: number | null) => void;
    onPackAmountChange: (value: number | null) => void;
    onOrgFeeChange: (value: number | null) => void;
    onDeliveryPercentChange: (value: number | null) => void;
    onGramsSelected?: () => void;
    unitWarning?: string | null;
    priceNote?: string | null;
}

export function PackPricingSection({
    unit,
    onUnitChange,
    pricePerPackCurrency,
    currencyId,
    packAmount,
    orgFeePercentOverride,
    orgFeeDefaultPercent,
    currencies,
    currencyRates,
    deliveryPercent,
    deliveryPercentOverride,
    onPriceChange,
    onCurrencyChange,
    onPackAmountChange,
    onOrgFeeChange,
    onDeliveryPercentChange,
    onGramsSelected,
    unitWarning,
    priceNote,
}: PackPricingSectionProps) {
    const isWeight = resolveUnit(unit)?.kind === 'WEIGHT';
    const sectionTitle = isWeight ? 'Цена за упаковку' : (PIECE_SECTION_TITLES[unit] ?? 'Цена за единицу');

    const handleUnitChange = (v: string) => {
        if (v === GRAM_UNIT) onGramsSelected?.();
        onUnitChange(v);
    };

    const rateToRub = resolveCurrencyRate(
        (currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        })),
        currencyId,
    );
    const effOrgFee = resolveOrgFeePercent(orgFeePercentOverride, orgFeeDefaultPercent);
    const effDelivery = resolveDeliveryPercent(deliveryPercentOverride, deliveryPercent);
    const effMarkupPercent = parseFloat((effOrgFee + effDelivery).toFixed(2));
    const pricingFields = {
        pricePerPackCurrency,
        currencyId,
        packAmount,
        orgFeePercentOverride,
        deliveryPercentOverride,
    };
    const packRub = getPackPriceRub(pricingFields, currencyRates ?? []);
    const packOrgRub = getPackPriceWithOrgFeeRub(pricingFields, currencyRates ?? [], orgFeeDefaultPercent);
    const packFullRub = computePackPriceWithOrgFee(packRub, effMarkupPercent);
    const unitFullRub = getUnitPriceWithDeliveryRub(
        pricingFields,
        currencyRates ?? [],
        orgFeeDefaultPercent,
        deliveryPercent,
    );
    const rubEditable = rateToRub != null && rateToRub > 0;
    const unitEditable = rubEditable && packAmount != null && packAmount > 0;
    const rubInputClassName = 'h-9 rounded-xl px-3 text-13-medium tabular-nums';

    return (
        <FormSection card title={sectionTitle}>
            <div className="shrink-0">
                <label className="mb-1 block text-13-regular text-fg-tertiary">Единица товара</label>
                <PackageUnitSelect value={unit} onChange={handleUnitChange} className="h-9 rounded-xl" />
                {unitWarning && <p className="mt-1.5 text-12-regular text-warning">{unitWarning}</p>}
            </div>

            <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                    <label className="mb-1 block text-13-regular text-fg-tertiary">Цена</label>
                    <Input
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        className="h-9 rounded-xl text-13-medium tabular-nums"
                        value={pricePerPackCurrency != null ? String(pricePerPackCurrency) : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onPriceChange(raw === '' ? null : Number(raw));
                        }}
                        placeholder="0"
                        aria-label="Цена за упаковку в валюте"
                    />
                    {priceNote && <p className="mt-1.5 text-12-regular text-fg-tertiary">{priceNote}</p>}
                </div>
                <div className="w-40 shrink-0">
                    <label className="mb-1 block text-13-regular text-fg-tertiary">Валюта</label>
                    <Select
                        value={currencyId != null ? String(currencyId) : 'none'}
                        onValueChange={(v) => {
                            onCurrencyChange(v === 'none' ? null : Number(v));
                        }}
                    >
                        <SelectTrigger className="h-9 rounded-xl" aria-label="Валюта цены">
                            <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {currencies.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                    {c.code ? ` (${c.code})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isWeight && (
                <div className="mt-3 flex items-end gap-2">
                    <div className="w-32 shrink-0">
                        <label className="mb-1 block text-13-regular text-fg-tertiary">Вес упаковки</label>
                        <Input
                            type="number"
                            step="0.001"
                            min={0}
                            inputMode="decimal"
                            className="h-9 rounded-xl text-13-medium tabular-nums"
                            value={packAmount != null ? String(packAmount) : ''}
                            onChange={(e) => {
                                const raw = e.target.value;
                                onPackAmountChange(raw === '' ? null : Number(raw));
                            }}
                            placeholder="0"
                            aria-label="Вес упаковки"
                        />
                    </div>
                    <span className="pb-2.5 text-13-regular text-fg-tertiary">{unit}</span>
                </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                    <label className="mb-1 block text-13-regular text-fg-tertiary">
                        Оргсбор, %<span className="ml-1 opacity-70">(по умолчанию {orgFeeDefaultPercent}%)</span>
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        inputMode="decimal"
                        className="h-9 w-full rounded-xl text-13-medium tabular-nums"
                        value={orgFeePercentOverride != null ? String(orgFeePercentOverride) : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onOrgFeeChange(raw === '' ? null : Number(raw));
                        }}
                        placeholder={String(orgFeeDefaultPercent)}
                        aria-label="Оргсбор процент"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-13-regular text-fg-tertiary">
                        Доставка, %<span className="ml-1 opacity-70">(по закупке {deliveryPercent}%)</span>
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        inputMode="decimal"
                        className="h-9 w-full rounded-xl text-13-medium tabular-nums"
                        value={deliveryPercentOverride != null ? String(deliveryPercentOverride) : ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onDeliveryPercentChange(raw === '' ? null : Number(raw));
                        }}
                        placeholder={String(deliveryPercent)}
                        aria-label="Процент доставки"
                    />
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                    <label className="mb-1 block text-13-regular text-fg-tertiary">Цена в ₽</label>
                    <InlineCell
                        value={packRub}
                        disabled={!rubEditable}
                        onCommit={(v) => onPriceChange(solvePricePerPackFromPackRub(v, rateToRub))}
                        min={0}
                        ariaLabel="Цена за упаковку в рублях"
                        placeholder="—"
                        format={formatWholeRub}
                        className={rubInputClassName}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-13-regular text-fg-tertiary">
                        С оргсбором, ₽<span className="ml-1 opacity-70">+{effOrgFee}%</span>
                    </label>
                    <InlineCell
                        value={packOrgRub}
                        disabled={!rubEditable}
                        onCommit={(v) => onPriceChange(solvePricePerPackFromPackOrgRub(v, rateToRub, effOrgFee))}
                        min={0}
                        ariaLabel="Цена за упаковку с оргсбором в рублях"
                        placeholder="—"
                        format={formatWholeRub}
                        className={rubInputClassName}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-13-regular text-fg-tertiary">
                        С доставкой, ₽<span className="ml-1 opacity-70">+{effMarkupPercent}%</span>
                    </label>
                    <InlineCell
                        value={packFullRub}
                        disabled={!rubEditable}
                        onCommit={(v) =>
                            onPriceChange(solvePricePerPackFromPackOrgRub(v, rateToRub, effOrgFee, effDelivery))
                        }
                        min={0}
                        ariaLabel="Цена за упаковку с доставкой в рублях"
                        placeholder="—"
                        format={formatWholeRub}
                        className={rubInputClassName}
                    />
                </div>
                {isWeight && (
                    <div>
                        <label className="mb-1 block text-13-regular text-fg-tertiary">За 1 ед, ₽</label>
                        <InlineCell
                            value={unitFullRub}
                            disabled={!unitEditable}
                            onCommit={(v) =>
                                onPriceChange(
                                    solvePricePerPackFromUnitRub(v, rateToRub, effOrgFee, packAmount, effDelivery),
                                )
                            }
                            min={0}
                            ariaLabel="Цена за 1 единицу в рублях"
                            placeholder="—"
                            format={formatUnitRub}
                            className={rubInputClassName}
                        />
                    </div>
                )}
            </div>

            <p className="mt-3 text-13-regular text-fg-tertiary">
                {isWeight
                    ? 'Поля связаны: введи цену в валюте или в любой рублёвой — остальные пересчитаются. Курс валюты задаётся в панели «Валюты закупки», оргсбор и доставка — процентом от базовой цены.'
                    : `Цена указывается за 1 ${unit}. Курс валюты задаётся в панели «Валюты закупки», оргсбор и доставка — процентом от базовой цены.`}
            </p>
        </FormSection>
    );
}

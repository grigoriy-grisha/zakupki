'use client';

import {
    resolveCurrencyRate,
    resolveOrgFeePercent,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from '@zakupki/types';

import { PACKAGE_UNITS } from '@/app/(admin)/products/lib';
import { PackageUnitSelect } from '@/components/shared/package-unit-select';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
    formatUnitRub,
    formatWholeRub,
    getPackPriceRub,
    getPackPriceWithOrgFeeRub,
    getUnitPriceRub,
} from '../../../../lib/items-table-pricing';
import type { PurchaseCurrencyRateRef } from '../../../../lib/types';
import { InlineCell } from '../../inline-cell';

/**
 * Sensible defaults when the admin picks grams as the package unit. Grams are
 * a bulk unit where a step of 1 is almost always wrong (nobody orders 1 gram
 * of tea); 5 g min packaging and 10 g reorder step match how organic small-batch
 * purchasing actually works in this domain. Only applied the moment the unit
 * switches to «гр» — the admin can still override afterwards, and switching
 * back to another unit does NOT reset the values.
 *
 * Exported so the parent form can apply the same defaults when wiring the
 * `onGramsSelected` callback (keeps the magic numbers in one place).
 */
export const GRAM_DEFAULT_MIN_PACKAGE = 5;
export const GRAM_DEFAULT_SUPPLEMENT_STEP = 10;
export const GRAM_UNIT = 'гр';

/** Строка валюты из trpc.currencies.list. */
interface CurrencyRow {
    id: number;
    name: string;
    code: string | null;
    symbol: string | null;
}

interface PackPricingSectionProps {
    /** Цена за упаковку в выбранной валюте. */
    pricePerPackCurrency: number | null;
    /** ID валюты (null = не выбрана). */
    currencyId: number | null;
    /** Вес упаковки (packAmount). */
    packAmount: number | null;
    /** Единица веса упаковки (packUnit: гр/шт/туба). */
    packUnit: string | null;
    /** Оргсбор % (override; null = используется глобальный default). */
    orgFeePercentOverride: number | null;
    /** Глобальный % оргсбора по умолчанию (для placeholder). */
    orgFeeDefaultPercent: number;
    /** Все валюты из справочника. */
    currencies: CurrencyRow[];
    /** Курсы валют закупки (для ₽-полей; без них ₽-поля выключены). */
    currencyRates?: PurchaseCurrencyRateRef[];
    onPriceChange: (value: number | null) => void;
    onCurrencyChange: (value: number | null) => void;
    onPackAmountChange: (value: number | null) => void;
    onPackUnitChange: (value: string | null) => void;
    onOrgFeeChange: (value: number | null) => void;
    /**
     * Optional: prefill these when the package unit switches to grams. Wired
     * by the parent form so that picking «гр» also sets the supplement-step
     * section defaults (min package 5, supplement step 10). Omitted on the
     * standalone product form where these fields don't exist.
     */
    onGramsSelected?: () => void;
}

/**
 * Секция «Цена за упаковку» — новая модель цен.
 *
 * Поля: цена в валюте + валюта (Select из справочника), вес упаковки +
 * единица (гр/шт/туба), оргсбор % (override; пусто = глобальный default).
 *
 * Цена в ₽, цена с оргсбором и цена за 1ед редактируются в форме и связаны
 * с ценой в валюте обратным пересчётом — как колонки 4/5/6 таблицы товаров.
 */
export function PackPricingSection({
    pricePerPackCurrency,
    currencyId,
    packAmount,
    packUnit,
    orgFeePercentOverride,
    orgFeeDefaultPercent,
    currencies,
    currencyRates,
    onPriceChange,
    onCurrencyChange,
    onPackAmountChange,
    onPackUnitChange,
    onOrgFeeChange,
    onGramsSelected,
}: PackPricingSectionProps) {
    // On switching the unit to grams, prefill min package and supplement step
    // with domain-sensible defaults via the parent's callback. Pass-through for
    // any other unit, so the admin's previously typed values survive a roundtrip.
    const handlePackUnitChange = (v: string | null) => {
        onPackUnitChange(v);
        if (v === GRAM_UNIT) onGramsSelected?.();
    };

    const rateToRub = resolveCurrencyRate(
        (currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        })),
        currencyId,
    );
    const effOrgFee = resolveOrgFeePercent(orgFeePercentOverride, orgFeeDefaultPercent);
    const pricingFields = { pricePerPackCurrency, currencyId, packAmount, orgFeePercentOverride };
    const packRub = getPackPriceRub(pricingFields, currencyRates ?? []);
    const packOrgRub = getPackPriceWithOrgFeeRub(pricingFields, currencyRates ?? [], orgFeeDefaultPercent);
    const unitRub = getUnitPriceRub(pricingFields, currencyRates ?? [], orgFeeDefaultPercent);
    const rubEditable = rateToRub != null && rateToRub > 0;
    const unitEditable = rubEditable && packAmount != null && packAmount > 0;
    const rubInputClassName = 'h-9 rounded-xl px-3 text-13-medium tabular-nums';

    return (
        <FormSection card title="Цена за упаковку">
            {/* Цена + валюта */}
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="mb-1 block text-12-regular text-fg-tertiary">Цена</label>
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
                </div>
                <div className="w-40 shrink-0">
                    <label className="mb-1 block text-12-regular text-fg-tertiary">Валюта</label>
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

            <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                    <label className="mb-1 block text-12-regular text-fg-tertiary">Цена в ₽</label>
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
                    <label className="mb-1 block text-12-regular text-fg-tertiary">
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
                    <label className="mb-1 block text-12-regular text-fg-tertiary">За 1 ед, ₽</label>
                    <InlineCell
                        value={unitRub}
                        disabled={!unitEditable}
                        onCommit={(v) =>
                            onPriceChange(solvePricePerPackFromUnitRub(v, rateToRub, effOrgFee, packAmount))
                        }
                        min={0}
                        ariaLabel="Цена за 1 единицу в рублях"
                        placeholder="—"
                        format={formatUnitRub}
                        className={rubInputClassName}
                    />
                </div>
            </div>

            {/* Вес упаковки + единица */}
            <div className="mt-3 flex items-end gap-2">
                <div className="w-32 shrink-0">
                    <label className="mb-1 block text-12-regular text-fg-tertiary">Вес упаковки</label>
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
                <div className="shrink-0">
                    <label className="mb-1 block text-12-regular text-fg-tertiary">Единица</label>
                    <PackageUnitSelect
                        value={packUnit ?? PACKAGE_UNITS[0]}
                        onChange={handlePackUnitChange}
                        className="h-9 rounded-xl"
                    />
                </div>
            </div>

            {/* Оргсбор % */}
            <div className="mt-3">
                <label className="mb-1 block text-12-regular text-fg-tertiary">
                    Оргсбор, %<span className="ml-1 opacity-70">(по умолчанию {orgFeeDefaultPercent}%)</span>
                </label>
                <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    className={cn('h-9 w-32 rounded-xl text-13-medium tabular-nums')}
                    value={orgFeePercentOverride != null ? String(orgFeePercentOverride) : ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onOrgFeeChange(raw === '' ? null : Number(raw));
                    }}
                    placeholder={String(orgFeeDefaultPercent)}
                    aria-label="Оргсбор процент"
                />
                <p className="mt-1.5 text-12-regular text-fg-tertiary">
                    Поля связаны: введи цену в валюте или в любой рублёвой — остальные пересчитаются. Курс валюты
                    задаётся в панели «Валюты закупки».
                </p>
            </div>
        </FormSection>
    );
}

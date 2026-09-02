/**
 * Расчёт колонок новой модели цен для админ-таблицы товаров.
 * Чистые функции поверх item + currencyRates + orgFeeDefaultPercent.
 *
 * Возвращают null, если часть данных не задана — UI покажет «—».
 */
import {
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    PURCHASE_FULFILLMENT_STATUSES,
    resolveCurrencyRate,
    resolveOrgFeePercent,
} from '@zakupki/types';

import type { PurchaseCurrencyRateRef, PurchaseItem } from './types';

/**
 * Поля, реально читаемые функциями расчёта цены. Вынесено из {@link PurchaseItem},
 * чтобы форма редактирования товара могла собрать минимальный объект из своих
 * live-значений без необходимости приведения к полному типу PurchaseItem
 * (в форме нет orderLines/product и пр.).
 */
export type ItemPricingFields = Pick<
    PurchaseItem,
    'pricePerPackCurrency' | 'currencyId' | 'packAmount' | 'orgFeePercentOverride'
>;

/** Кол. 4: цена упаковки в ₽ = pricePerPackCurrency × курс. */
export function getPackPriceRub(item: ItemPricingFields, rates: PurchaseCurrencyRateRef[]): number | null {
    const priceCur = toNum(item.pricePerPackCurrency);
    const rate = resolveCurrencyRate(toRates(rates), item.currencyId ?? null);
    return computePackPriceRub(priceCur, rate);
}

export function getRateToRub(item: ItemPricingFields, rates: PurchaseCurrencyRateRef[]): number | null {
    return resolveCurrencyRate(toRates(rates), item.currencyId ?? null);
}

export function formatWholeRub(value: number): string {
    return String(Math.round(value));
}

export function formatUnitRub(value: number): string {
    return Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(2)));
}

/** Кол. 5: цена упаковки с оргсбором = цена в ₽ × (1 + оргсбор/100). */
export function getPackPriceWithOrgFeeRub(
    item: ItemPricingFields,
    rates: PurchaseCurrencyRateRef[],
    orgFeeDefaultPercent: number,
): number | null {
    const packRub = getPackPriceRub(item, rates);
    const orgFee = resolveOrgFeePercent(toNum(item.orgFeePercentOverride), orgFeeDefaultPercent);
    return computePackPriceWithOrgFee(packRub, orgFee);
}

/** Кол. 6: цена за 1ед (гр/шт) в ₽ = (цена уп. с оргсбором) / вес упаковки. */
export function getUnitPriceRub(
    item: ItemPricingFields,
    rates: PurchaseCurrencyRateRef[],
    orgFeeDefaultPercent: number,
): number | null {
    const packOrg = getPackPriceWithOrgFeeRub(item, rates, orgFeeDefaultPercent);
    return computeUnitPriceRub(packOrg, toNum(item.packAmount));
}


/**
 * Кол. 7 «Собрано»: сумма effective qty = quantity + packageCount × packSize
 * по ACTIVE orderLines. Совпадает с расчётом бота (sumOrderLines) и доменной
 * моделью (computeAmountDueNewModel использует ту же effectiveQty).
 *
 * packSize = item.packAmount (вес пачки в новой модели). Если packAmount не
 * задан — пакеты не имеют смысла, считаем только quantity.
 */
export function getCollectedQty(item: PurchaseItem): number {
    const packSize = toNum(item.packAmount) ?? 0;
    return item.orderLines
        .filter((l) => (l as { status?: string }).status !== 'CANCELLED')
        .reduce(
            (sum, l) =>
                sum + Number(l.quantity ?? 0) + Number(l.packageCount ?? 0) * packSize,
            0,
        );
}

/**
 * Авторасчёт остатка по целым пачкам, когда операционные количества не заданы
 * организатором. Округляем собранное вверх до целых пачек поставщика:
 * `ceil(collected / packSize) × packSize − collected`. Совпадает с авто-пулом
 * добора (computeRawPool путь 2 в shared/types). Возвращает 0 при собрано = 0.
 */
export function computeAutoRemainder(collected: number, packSize: number | null): number {
    if (collected <= 0) return 0;
    if (packSize == null || packSize <= 0) return 0;
    const packsNeeded = Math.max(1, Math.ceil(collected / packSize - 1e-9));
    return packsNeeded * packSize - collected;
}

/**
 * Кол. 11 «Остаток на пристрой» — фазозависимо:
 *  - до SUPPLIER_ASSEMBLY: orderedQty − собрано
 *  - с SUPPLIER_ASSEMBLY: (assembledQty + reorderedQty) − собрано
 * Если операционные количества не заполнены (null) — авторасчёт по целым пачкам.
 * >0 = излишек на пристрой, <0 = недостача.
 */
export function getRemainderQty(
    item: PurchaseItem,
    fulfillmentStatus: string | null | undefined,
): number | null {
    const collected = getCollectedQty(item);
    const packSize = toNum(item.packAmount);
    const isAfterSettlement = isAtOrAfterSupplierAssembly(fulfillmentStatus);
    if (isAfterSettlement) {
        const assembled = toNum(item.assembledQty);
        const reordered = toNum(item.reorderedQty);
        if (assembled == null && reordered == null) {
            return computeAutoRemainder(collected, packSize);
        }
        return (assembled ?? 0) + (reordered ?? 0) - collected;
    }
    const ordered = toNum(item.orderedQty);
    if (ordered == null) {
        return computeAutoRemainder(collected, packSize);
    }
    return ordered - collected;
}

/**
 * Граница «получен итоговый расчёт от поставщика» = SUPPLIER_ASSEMBLY и далее.
 * Порядок стадий берётся из единого источника (PURCHASE_FULFILLMENT_STATUSES),
 * чтобы при добавлении новой стадии не пришлось править этот файл.
 */
export function isAtOrAfterSupplierAssembly(fulfillmentStatus: string | null | undefined): boolean {
    const order = PURCHASE_FULFILLMENT_STATUSES as readonly string[];
    const idx = order.indexOf(fulfillmentStatus ?? '');
    const cutoff = order.indexOf('SUPPLIER_ASSEMBLY');
    return idx >= cutoff && cutoff >= 0;
}

// ── Внутренние helpers ──

function toNum(value: string | number | null | undefined): number | null {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toRates(
    rates: PurchaseCurrencyRateRef[],
): { currencyId: number; rateToRub: number }[] {
    return rates.map((r) => ({ currencyId: r.currencyId, rateToRub: Number(r.rateToRub) }));
}

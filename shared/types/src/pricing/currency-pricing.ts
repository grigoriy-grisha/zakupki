/**
 * Новая модель цен: «цена за упаковку в валюте × курс × оргсбор → цена за 1ед в ₽».
 *
 * Чистые функции без зависимостей от Prisma/Decimal. Округление денежных величин —
 * до копеек (2 знака). Количественные (вес) — без округления.
 *
 * Заменяет старый движок (priceTiers + supplierPackagePrice + computeDiscountedPackPrice).
 */

/** Ставка валюты к рублю в рамках конкретной закупки. */
export interface CurrencyRate {
    currencyId: number;
    rateToRub: number;
}

/**
 * Кол. 4: цена за упаковку в рублях = цена в валюте × курс.
 * Возвращает null, если цена или курс не заданы/некорректны.
 */
export function computePackPriceRub(pricePerPackCurrency: number | null, rateToRub: number | null): number | null {
    if (pricePerPackCurrency == null || rateToRub == null) return null;
    if (!Number.isFinite(pricePerPackCurrency) || !Number.isFinite(rateToRub)) return null;
    return roundMoney(pricePerPackCurrency * rateToRub);
}

/**
 * Резолв % оргсбора: переопределение товара приоритетнее глобальной настройки.
 */
export function resolveOrgFeePercent(override: number | null, globalDefault: number): number {
    if (override != null && Number.isFinite(override)) return override;
    return globalDefault;
}

/**
 * Резолв % доставки: переопределение товара приоритетнее процента закупки.
 */
export function resolveDeliveryPercent(override: number | null, purchasePercent: number): number {
    if (override != null && Number.isFinite(override)) return override;
    return purchasePercent;
}

/**
 * Кол. 5: цена за упаковку с оргсбором = цена в ₽ × (1 + оргсбор/100).
 * Возвращает null, если базовая цена неизвестна.
 */
export function computePackPriceWithOrgFee(packPriceRub: number | null, orgFeePercent: number): number | null {
    if (packPriceRub == null) return null;
    return roundMoney(packPriceRub * (1 + orgFeePercent / 100));
}

/**
 * Кол. 6: цена за 1ед (гр/шт) в ₽ = цена упаковки с оргсбором / вес упаковки.
 * Возвращает null, если цена или вес неизвестны или вес ≤ 0.
 */
export function computeUnitPriceRub(packPriceWithOrgFee: number | null, packSize: number | null): number | null {
    if (packPriceWithOrgFee == null || packSize == null || packSize <= 0) return null;
    return roundMoney(packPriceWithOrgFee / packSize);
}

export function solvePricePerPackFromPackRub(
    packPriceRub: number | null,
    rateToRub: number | null,
): number | null {
    if (packPriceRub == null || !isPositiveFinite(rateToRub)) return null;
    return roundPrice4(packPriceRub / rateToRub);
}

export function solvePricePerPackFromPackOrgRub(
    packPriceWithOrgFeeRub: number | null,
    rateToRub: number | null,
    orgFeePercent: number,
    deliveryPercent?: number,
): number | null {
    if (packPriceWithOrgFeeRub == null || !isPositiveFinite(rateToRub)) return null;
    const divisor = totalMarkupDivisor(orgFeePercent, deliveryPercent);
    if (!Number.isFinite(divisor) || divisor <= 0) return null;
    return roundPrice4(packPriceWithOrgFeeRub / divisor / rateToRub);
}

export function solvePricePerPackFromUnitRub(
    unitPriceRub: number | null,
    rateToRub: number | null,
    orgFeePercent: number,
    packAmount: number | null,
    deliveryPercent?: number,
): number | null {
    if (unitPriceRub == null || !isPositiveFinite(rateToRub)) return null;
    if (packAmount == null || !Number.isFinite(packAmount) || packAmount <= 0) return null;
    const divisor = totalMarkupDivisor(orgFeePercent, deliveryPercent);
    if (!Number.isFinite(divisor) || divisor <= 0) return null;
    return roundPrice4((unitPriceRub * packAmount) / divisor / rateToRub);
}

function isPositiveFinite(value: number | null): value is number {
    return value != null && Number.isFinite(value) && value > 0;
}

/**
 * Найти курс валюты по id среди ставок закупки.
 */
export function resolveCurrencyRate(rates: readonly CurrencyRate[], currencyId: number | null): number | null {
    if (currencyId == null) return null;
    const rate = rates.find((r) => r.currencyId === currencyId);
    return rate ? rate.rateToRub : null;
}

/**
 * Полный расчёт цены за единицу (кол. 6) одним заходом — используется в расчёте
 * сумм заказов (amountDue = effectiveQty × unitPriceRub).
 *
 * Возвращает null, если хотя бы один элемент цепочки не задан.
 */
export function computeUnitPriceRubFromItem(input: {
    pricePerPackCurrency: number | null;
    rateToRub: number | null;
    orgFeePercent: number;
    /** % доставки закупки, аддитивно к оргсбору. */
    deliveryPercent?: number;
    packSize: number | null;
}): number | null {
    const packRub = computePackPriceRub(input.pricePerPackCurrency, input.rateToRub);
    const markupDivisor = totalMarkupDivisor(input.orgFeePercent, input.deliveryPercent);
    const packOrg = packRub == null ? null : roundMoney(packRub * markupDivisor);
    return computeUnitPriceRub(packOrg, input.packSize);
}

/**
 * Итоговый множитель наценки: 1 + (оргсбор + доставка)/100 — аддитивно,
 * оба процента считаются от базовой цены (1000 + 10% + 5% = 1150).
 */
export function totalMarkupDivisor(orgFeePercent: number, deliveryPercent?: number): number {
    return 1 + (orgFeePercent + (deliveryPercent ?? 0)) / 100;
}

export interface OrderLinePriceBreakdown {
    /** Базовая цена товара без наценок (валюта × курс × количество). */
    baseRub: number;
    orgFeeRub: number;
    orgFeePercent: number;
    deliveryRub: number;
    deliveryPercent: number;
}

/**
 * Расшифровка суммы строки заказа для клиента: база + оргсбор + доставка.
 * Компоненты считаются от базовой цены, последняя ненулевая наценка —
 * балансом от amountDue, чтобы сумма компонентов сходилась до копейки.
 * Скидка за целые пачки (packDiscountPercent) уменьшает базу пропорционально
 * доле пачечного количества — иначе components не сошлись бы с уменьшенным
 * amountDue (скидка уже сидит внутри него).
 * Возвращает null, если цена не задана (нет курса/цены/веса упаковки).
 */
export function computeOrderLinePriceBreakdown(input: {
    amountDue: number;
    quantity: number;
    packageCount: number;
    pricePerPackCurrency: number | null;
    rateToRub: number | null;
    packSize: number | null;
    orgFeePercent: number;
    deliveryPercent: number;
    /** % скидки за целые пачки. 0/undefined — без скидки. */
    packDiscountPercent?: number;
}): OrderLinePriceBreakdown | null {
    if (
        input.pricePerPackCurrency == null ||
        !Number.isFinite(input.pricePerPackCurrency) ||
        input.rateToRub == null ||
        !Number.isFinite(input.rateToRub) ||
        input.packSize == null ||
        input.packSize <= 0
    ) {
        return null;
    }
    const effectiveQty = input.quantity + input.packageCount * input.packSize;
    if (!Number.isFinite(effectiveQty) || effectiveQty <= 0) return null;

    const unitBase = (input.pricePerPackCurrency * input.rateToRub) / input.packSize;
    // Скидка касается только пачечных граммов: base × (1 − d × packQty/effectiveQty).
    let discountFactor = 1;
    if (input.packDiscountPercent != null && input.packDiscountPercent > 0) {
        const fullPacks = Math.floor((effectiveQty + 1e-9) / input.packSize);
        const packQty = fullPacks * input.packSize;
        discountFactor = 1 - (input.packDiscountPercent / 100) * (packQty / effectiveQty);
    }
    const baseRub = roundMoney(effectiveQty * unitBase * discountFactor);
    const hasOrg = input.orgFeePercent > 0;
    const hasDelivery = input.deliveryPercent > 0;

    if (!hasOrg && !hasDelivery) {
        return {
            baseRub: input.amountDue,
            orgFeeRub: 0,
            orgFeePercent: 0,
            deliveryRub: 0,
            deliveryPercent: 0,
        };
    }
    if (!hasDelivery) {
        return {
            baseRub,
            orgFeeRub: roundMoney(input.amountDue - baseRub),
            orgFeePercent: input.orgFeePercent,
            deliveryRub: 0,
            deliveryPercent: 0,
        };
    }
    if (!hasOrg) {
        return {
            baseRub,
            orgFeeRub: 0,
            orgFeePercent: 0,
            deliveryRub: roundMoney(input.amountDue - baseRub),
            deliveryPercent: input.deliveryPercent,
        };
    }
    const orgFeeRub = roundMoney(baseRub * (input.orgFeePercent / 100));
    return {
        baseRub,
        orgFeeRub,
        orgFeePercent: input.orgFeePercent,
        deliveryRub: roundMoney(input.amountDue - baseRub - orgFeeRub),
        deliveryPercent: input.deliveryPercent,
    };
}

/**
 * Сумма к оплате по новой модели: effectiveQty × unitPriceRub.
 * effectiveQty = quantity + packageCount × packSize (как в старой модели).
 *
 * Возвращает null, если unitPriceRub не удалось вычислить.
 */
export function computeAmountDueNewModel(input: {
    quantity: number;
    packageCount: number;
    packSize: number | null;
    unitPriceRub: number | null;
}): number | null {
    if (input.unitPriceRub == null) return null;
    const packSize = input.packSize ?? 0;
    const effectiveQty = input.quantity + input.packageCount * packSize;
    return roundMoney(effectiveQty * input.unitPriceRub);
}

/** Округление денег до копеек. */
export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Округление валютной цены до 4 знаков (точность колонки в БД). */
function roundPrice4(value: number): number {
    return Math.round(value * 10000) / 10000;
}

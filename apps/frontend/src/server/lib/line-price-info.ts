import {
    computeOrderLinePriceBreakdown,
    isWeightUnit,
    resolveCurrencyRate,
    resolveDeliveryPercent,
    resolveOrgFeePercent,
} from '@zakupki/types';

export type LinePriceSource = {
    purchaseItem: {
        currencyId: number | null;
        unitCode: string | null;
        pricePerPackCurrency: unknown;
        packAmount: unknown;
        orgFeePercentOverride: unknown;
        deliveryPercentOverride: unknown;
        purchase: {
            deliveryPercent: unknown;
            currencyRates: { currencyId: number; rateToRub: unknown }[];
        } | null;
    } | null;
};

/** Цена, курс и наценки строки заказа: то, что нужно для расшифровки суммы (база / оргсбор / доставка). */
export function buildLinePriceInfo(line: LinePriceSource, orgFeeDefaultPercent: number, packDiscountPercent: number) {
    const item = line.purchaseItem;
    const purchase = item?.purchase;
    if (!item || !purchase) return null;
    const rateToRub = resolveCurrencyRate(
        (purchase.currencyRates ?? []).map((r) => ({
            currencyId: r.currencyId,
            rateToRub: Number(r.rateToRub),
        })),
        item.currencyId ?? null,
    );
    return {
        pricePerPackCurrency: item.pricePerPackCurrency != null ? Number(item.pricePerPackCurrency) : null,
        rateToRub,
        packSize: item.packAmount != null ? Number(item.packAmount) : null,
        // Скидка за целые пачки при расчёте суммы действует только для весовых товаров (см. hasActivePackDiscount).
        packDiscountPercent: isWeightUnit(item.unitCode) ? packDiscountPercent : 0,
        orgFeePercent: resolveOrgFeePercent(
            item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
            orgFeeDefaultPercent,
        ),
        deliveryPercent: resolveDeliveryPercent(
            item.deliveryPercentOverride != null ? Number(item.deliveryPercentOverride) : null,
            Number(purchase.deliveryPercent ?? 0),
        ),
    };
}

/** Расшифровка суммы строки (база / доставка / оргсбор). null — у позиции нет цены или закупки. */
export function priceOrderLine(
    line: LinePriceSource & { amountDue: unknown; quantity: unknown; packageCount: unknown },
    orgFeeDefaultPercent: number,
    packDiscountPercent: number,
) {
    const info = buildLinePriceInfo(line, orgFeeDefaultPercent, packDiscountPercent);
    if (!info) return { info: null, breakdown: null };
    const breakdown = computeOrderLinePriceBreakdown({
        ...info,
        amountDue: Number(line.amountDue),
        quantity: Number(line.quantity),
        packageCount: Number(line.packageCount ?? 0),
    });
    return { info, breakdown };
}

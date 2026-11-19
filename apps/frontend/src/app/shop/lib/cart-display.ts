import {
    buildOrderQtyOptions,
    computeOrderLinePriceBreakdown,
    computeUnitPriceRubFromItem,
    getActiveStep,
    roundMoney,
} from '@zakupki/types';

import type { MergedOrderLine } from '@/app/shop/lib/order-grouping';

export interface CartPriceInfo {
    pricePerPackCurrency: number | null;
    rateToRub: number | null;
    packSize: number | null;
    packDiscountPercent?: number;
    orgFeePercent: number;
    deliveryPercent: number;
}

/** Цена за единицу — той же функцией, что считает сервер (с округлением на каждом шаге). */
export function unitPriceFromPriceInfo(info: CartPriceInfo | null | undefined): number | null {
    if (!info) return null;
    return computeUnitPriceRubFromItem({
        pricePerPackCurrency: info.pricePerPackCurrency,
        rateToRub: info.rateToRub,
        orgFeePercent: info.orgFeePercent,
        deliveryPercent: info.deliveryPercent,
        packSize: info.packSize,
    });
}

type BreakdownSourceLine = {
    amountDue?: unknown;
    quantity?: unknown;
    packageCount?: unknown;
    priceInfo?: unknown;
};

function breakdownOfLine(line: BreakdownSourceLine) {
    const priceInfo = line.priceInfo as CartPriceInfo | null | undefined;
    if (!priceInfo) return null;
    return computeOrderLinePriceBreakdown({
        amountDue: Number(line.amountDue ?? 0),
        quantity: Number(line.quantity ?? 0),
        packageCount: Number(line.packageCount ?? 0),
        pricePerPackCurrency: priceInfo.pricePerPackCurrency,
        rateToRub: priceInfo.rateToRub,
        packSize: priceInfo.packSize,
        packDiscountPercent: priceInfo.packDiscountPercent ?? 0,
        orgFeePercent: priceInfo.orgFeePercent,
        deliveryPercent: priceInfo.deliveryPercent,
    });
}

/**
 * Расшифровка объединённой строки: считаем каждую исходную строку отдельно (как сервер и бот)
 * и складываем — иначе скидка за пачку «находится» на сумме сбора и добора, где её не было.
 */
export function linePriceBreakdown(order: MergedOrderLine) {
    const lines: BreakdownSourceLine[] = order.lines?.length ? order.lines : [order.source ?? {}];
    const parts = lines
        .filter((l) => Number(l.quantity ?? 0) > 0 || Number(l.packageCount ?? 0) > 0)
        .map(breakdownOfLine);
    const valid = parts.filter((p): p is NonNullable<typeof p> => p != null);
    if (valid.length === 0 || valid.length !== parts.length) return null;
    const [first, ...rest] = valid;
    return rest.reduce(
        (acc, p) => ({
            ...acc,
            baseRub: roundMoney(acc.baseRub + p.baseRub),
            orgFeeRub: roundMoney(acc.orgFeeRub + p.orgFeeRub),
            deliveryRub: roundMoney(acc.deliveryRub + p.deliveryRub),
        }),
        first,
    );
}

interface StepSourceItem {
    unitCode?: string | null;
    multiplicity?: unknown;
    minPackageAmount?: unknown;
    supplementStep?: unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product?: any;
}

export function activeOrderStep(purchaseItem: StepSourceItem, fulfillmentStatus: string): number {
    const step = getActiveStep({
        fulfillmentStatus,
        options: buildOrderQtyOptions({
            multiplicity: Number(purchaseItem.multiplicity) || 1,
            minPackageAmount: purchaseItem.minPackageAmount != null ? Number(purchaseItem.minPackageAmount) : null,
            minPackageUnit: null,
            unitCode: purchaseItem.unitCode ?? purchaseItem.product?.unitCode ?? null,
        }),
        supplementStep: purchaseItem.supplementStep != null ? Number(purchaseItem.supplementStep) : null,
    });
    return Math.max(1, Math.round(step));
}

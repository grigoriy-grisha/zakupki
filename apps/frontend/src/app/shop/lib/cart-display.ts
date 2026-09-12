import { buildOrderQtyOptions, computeOrderLinePriceBreakdown, getActiveStep } from '@zakupki/types';

import type { MergedOrderLine } from '@/app/shop/lib/order-grouping';

export interface CartPriceInfo {
    pricePerPackCurrency: number | null;
    rateToRub: number | null;
    packSize: number | null;
    packDiscountPercent?: number;
    orgFeePercent: number;
    deliveryPercent: number;
}

export function unitPriceFromPriceInfo(info: CartPriceInfo | null | undefined): number | null {
    if (!info) return null;
    const { pricePerPackCurrency, rateToRub, packSize, orgFeePercent, deliveryPercent } = info;
    if (pricePerPackCurrency == null || rateToRub == null || rateToRub <= 0) return null;
    const size = packSize != null && Number(packSize) > 0 ? Number(packSize) : 1;
    const unit = (Number(pricePerPackCurrency) * rateToRub * (1 + (orgFeePercent + deliveryPercent) / 100)) / size;
    return Math.round(unit * 100) / 100;
}

export function linePriceBreakdown(order: MergedOrderLine) {
    const priceInfo = order.source?.priceInfo as CartPriceInfo | null | undefined;
    if (!priceInfo) return null;
    return computeOrderLinePriceBreakdown({
        amountDue: order.amountDue,
        quantity: order.quantity,
        packageCount: order.packageCount,
        pricePerPackCurrency: priceInfo.pricePerPackCurrency,
        rateToRub: priceInfo.rateToRub,
        packSize: priceInfo.packSize,
        packDiscountPercent: priceInfo.packDiscountPercent ?? 0,
        orgFeePercent: priceInfo.orgFeePercent,
        deliveryPercent: priceInfo.deliveryPercent,
    });
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
            minPackageAmount:
                purchaseItem.minPackageAmount != null ? Number(purchaseItem.minPackageAmount) : null,
            minPackageUnit: null,
            unitCode: purchaseItem.unitCode ?? purchaseItem.product?.unitCode ?? null,
        }),
        supplementStep: purchaseItem.supplementStep != null ? Number(purchaseItem.supplementStep) : null,
    });
    return Math.max(1, Math.round(step));
}

import type { PurchaseItem } from '@zakupki/types';
import { computePackagePrice, computeUnitPriceRubNewModel, getOrderQuantityStep, isWeightUnit } from '@zakupki/types';

export function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQty(value: number): number {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function toNumber(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

export type PriceCells = {
    packPrice: number | string;
    facingPrice: number | string;
    unitPrice: number | string;
};

export function facingSize(item: PurchaseItem): number | null {
    if (!isWeightUnit(item.unitCode)) return null;
    const step = getOrderQuantityStep({
        unitCode: item.unitCode,
        minPackageAmount: item.minPackageAmount,
        multiplicity: item.multiplicity,
    });
    return step > 0 ? step : null;
}

export function priceCells(item: PurchaseItem | undefined): PriceCells {
    if (!item) return { packPrice: '', facingPrice: '', unitPrice: '' };
    const unitPrice = computeUnitPriceRubNewModel(item);
    if (unitPrice == null) {
        return { packPrice: '', facingPrice: '', unitPrice: 'Цена уточняется' };
    }
    const facing = facingSize(item);
    return {
        packPrice: roundMoney(computePackagePrice(item)),
        facingPrice: facing != null ? roundMoney(facing * unitPrice) : '',
        unitPrice: roundMoney(unitPrice),
    };
}

export type QuantitySplit = {
    partialQty: number | '';
    fullPackCell: string;
    partialGr: number;
    fullPackGr: number;
};

export function quantitySplit(
    line: { quantity?: unknown; packageCount?: unknown },
    packSize: number | null,
    weight: boolean,
): QuantitySplit {
    const qty = roundQty(toNumber(line.quantity));
    const packs = Math.trunc(toNumber(line.packageCount));
    const packGrams = packs > 0 && packSize ? roundQty(packs * packSize) : 0;

    let fullPackCell = '';
    if (packs > 0) {
        fullPackCell = packGrams > 0 ? `${packGrams} (${packs} уп)` : `${packs} уп`;
    }

    return {
        partialQty: qty > 0 ? qty : '',
        fullPackCell,
        partialGr: weight ? qty : 0,
        fullPackGr: weight ? packGrams : 0,
    };
}

export type AmountSplit = {
    partial: number;
    fullPack: number;
};

export function amountSplit(
    line: { amountDue?: unknown; packageCount?: unknown },
    item: PurchaseItem | undefined,
): AmountSplit {
    const amount = roundMoney(toNumber(line.amountDue));
    const packs = Math.trunc(toNumber(line.packageCount));
    const packPrice = item ? computePackagePrice(item) : 0;
    if (packs > 0 && packPrice > 0) {
        const fullPack = Math.min(amount, roundMoney(packs * packPrice));
        return { partial: roundMoney(amount - fullPack), fullPack };
    }
    return { partial: amount, fullPack: 0 };
}

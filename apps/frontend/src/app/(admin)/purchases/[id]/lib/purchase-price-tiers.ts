import { parsePriceTiers } from '@zakupki/types';
import { PACKAGE_UNITS, type PackageUnit } from '../../../products/lib';
import { normalizePackageUnit, resolveProductPackageUnit, withCatalogPackageUnits } from './package-units';
import type { PurchaseProductFieldSource } from './package-units';

export type PurchasePriceTier = { amount: number; unit: string; price: number };

/** Проверка цен перед сохранением товара в закупке. */
export function validatePurchasePriceTiers(tiers: PurchasePriceTier[]): string | null {
    if (tiers.length === 0) return 'Укажите хотя бы одну цену';
    const hasValid = tiers.some((t) => t.amount > 0 && t.unit.trim() && t.price > 0);
    if (!hasValid) return 'Укажите цену больше 0';
    return null;
}

export function getInitialSupplierTiers(
    product: PurchaseProductFieldSource,
    catalogUnit: PackageUnit,
): PurchasePriceTier[] {
    const fromJson = parsePriceTiers(product.supplierPackageTiers);
    if (fromJson.length > 0) {
        return fromJson.map((t) => ({
            amount: Math.max(0, Math.trunc(t.amount)),
            unit: normalizePackageUnit(t.unit) ?? catalogUnit,
            price: Number(t.price),
        }));
    }
    if (product.supplierPackageAmount != null && product.supplierPackageUnit) {
        return [
            {
                amount: Math.max(0, Math.trunc(Number(product.supplierPackageAmount))),
                unit: normalizePackageUnit(product.supplierPackageUnit) ?? catalogUnit,
                price: product.supplierPackagePrice != null ? Number(product.supplierPackagePrice) : 0,
            },
        ];
    }
    return [{ amount: 0, unit: catalogUnit, price: 0 }];
}

/** Валидные тиры фасовки поставщика + основная фасовка (первая строка) для заказа по пачке. */
export function normalizeSupplierTiersForSave(tiers: PurchasePriceTier[]): {
    supplierPackageTiers: PurchasePriceTier[];
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
} {
    const valid = tiers
        .filter((t) => t.amount > 0 && t.price > 0 && t.unit.trim())
        .map((t) => ({
            amount: Math.trunc(t.amount),
            unit: t.unit.trim(),
            price: t.price,
        }));
    const first = valid[0];
    return {
        supplierPackageTiers: valid,
        supplierPackageAmount: first ? first.amount : null,
        supplierPackageUnit: first?.unit ?? null,
        supplierPackagePrice: first ? first.price : null,
    };
}

export function primarySupplierPackageFromTiers(tiers: PurchasePriceTier[]): {
    amount: number | null;
    unit: string | null;
    price: number | null;
} {
    const { supplierPackageAmount, supplierPackageUnit, supplierPackagePrice } = normalizeSupplierTiersForSave(tiers);
    return {
        amount: supplierPackageAmount,
        unit: supplierPackageUnit,
        price: supplierPackagePrice,
    };
}

export function emptyPurchaseFields(unit?: string): PurchaseProductFormState {
    const u = unit ?? PACKAGE_UNITS[0];
    return {
        description: '',
        tiers: [{ amount: 0, unit: u, price: 0 }],
        minPkgAmount: null,
        minPkgUnit: u,
        supPkgTiers: [{ amount: 0, unit: u, price: 0 }],
        supplementStep: null,
        supplierLimit: null,
        supplierLimitUnit: u,
        targetRemainder: null,
    };
}

export function savedPurchaseFields(product: PurchaseProductFieldSource): PurchaseProductFormState {
    const catalogUnit = resolveProductPackageUnit(product);
    const parsedTiers = parsePriceTiers(product.priceTiers);
    const tiers = parsedTiers.length > 0
        ? parsedTiers.map((t) => ({
              amount: Math.max(1, Math.trunc(t.amount)),
              unit: normalizePackageUnit(t.unit) ?? catalogUnit,
              price: Number(t.price),
          }))
        : [{ amount: 1, unit: catalogUnit, price: 0 }];
    return withCatalogPackageUnits(
        {
            description: product.description ?? '',
            tiers,
            minPkgAmount: product.minPackageAmount != null ? Math.trunc(Number(product.minPackageAmount)) : null,
            minPkgUnit: product.minPackageUnit ?? catalogUnit,
            supPkgTiers: getInitialSupplierTiers(product, catalogUnit),
            supplementStep: product.supplementStep != null ? Number(product.supplementStep) : null,
            supplierLimit: product.supplierLimit != null ? Math.trunc(Number(product.supplierLimit)) : null,
            supplierLimitUnit: product.supplierLimitUnit ?? catalogUnit,
            targetRemainder: product.targetRemainder != null ? Number(product.targetRemainder) : null,
        },
        catalogUnit,
    );
}

export function buildPurchaseFormState(
    product: PurchaseProductFieldSource,
    loadSavedDescription: boolean,
): PurchaseProductFormState {
    const catalogUnit = resolveProductPackageUnit(product);
    if (loadSavedDescription) return savedPurchaseFields(product);
    return emptyPurchaseFields(catalogUnit);
}

/**
 * Сливает «продуктовые» поля (для каталожной части: unitCode) и «per-purchase»
 * поля (для всего остального) в один плоский объект, который умеет читать
 * `buildPurchaseFormState`. В PurchaseProductFieldSource все поля опциональны —
 * любой из двух источников можно передать.
 */
export function mergeProductAndPurchaseFields(
    product: Record<string, unknown>,
    purchaseFields: Partial<PurchaseProductFieldSource> | undefined,
): PurchaseProductFieldSource {
    return {
        ...product,
        ...(purchaseFields ?? {}),
    } as PurchaseProductFieldSource;
}

export type PurchaseProductFormState = {
    description: string;
    tiers: PurchasePriceTier[];
    minPkgAmount: number | null;
    minPkgUnit: string;
    supPkgTiers: PurchasePriceTier[];
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string;
    targetRemainder: number | null;
};

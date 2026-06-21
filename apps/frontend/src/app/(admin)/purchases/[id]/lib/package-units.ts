import { PACKAGE_UNITS, type PackageUnit } from '../../../products/lib';
import { getUnitByCode, resolveUnit } from '@zakupki/types';

export function isPackageUnit(value: string): value is PackageUnit {
    return (PACKAGE_UNITS as readonly string[]).includes(value);
}

export type PurchaseProductFieldSource = {
    description?: string | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplierPackageAmount?: string | number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: string | number | null;
    supplierPackageTiers?: unknown;
    supplementStep?: string | number | null;
    // Глобальный лимит поставщика (per-purchase). Хранится в PurchaseItem.
    supplierLimit?: string | number | null;
    supplierLimitUnit?: string | null;
    // Fix #8: целевой остаток (на этапе REORDER) — теперь редактируется и в ItemEditSheet.
    targetRemainder?: string | number | null;
    unitCode?: string;
};

export function normalizePackageUnit(raw?: string | null): PackageUnit | null {
    const s = raw?.trim();
    if (!s) return null;
    if (isPackageUnit(s)) return s;
    const unit = resolveUnit(s);
    if (unit) return unit.shortName as PackageUnit;
    return null;
}

/** Единица для полей фасовки/цен: из сохранённых полей товара или единица учёта каталога. */
export function resolveProductPackageUnit(product: PurchaseProductFieldSource): PackageUnit {
    for (const candidate of [
        product.minPackageUnit,
        product.supplierPackageUnit,
        product.supplierLimitUnit,
        product.unitCode ? getUnitByCode(product.unitCode)?.shortName : null,
    ]) {
        const normalized = normalizePackageUnit(candidate);
        if (normalized) return normalized;
    }
    return PACKAGE_UNITS[0];
}

export function withCatalogPackageUnits<
    T extends {
        tiers: { unit: string }[];
        supPkgTiers: { unit: string }[];
        minPkgUnit: string;
        supplierLimitUnit: string;
    },
>(state: T, catalogUnit: PackageUnit): T {
    return {
        ...state,
        tiers: state.tiers.map((t) => ({ ...t, unit: normalizePackageUnit(t.unit) ?? catalogUnit })),
        supPkgTiers: state.supPkgTiers.map((t) => ({ ...t, unit: normalizePackageUnit(t.unit) ?? catalogUnit })),
        minPkgUnit: normalizePackageUnit(state.minPkgUnit) ?? catalogUnit,
        supplierLimitUnit: normalizePackageUnit(state.supplierLimitUnit) ?? catalogUnit,
    };
}

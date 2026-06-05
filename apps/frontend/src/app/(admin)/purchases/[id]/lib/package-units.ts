import { PACKAGE_UNITS, type PackageUnit } from '../../../products/lib';

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
    availableAmount?: string | number | null;
    availableUnit?: string | null;
    unit?: { shortName?: string | null; name?: string | null } | null;
};

export function normalizePackageUnit(raw?: string | null): PackageUnit | null {
    const s = raw?.trim();
    if (!s) return null;
    if (isPackageUnit(s)) return s;
    const lower = s.toLowerCase();
    const exact = PACKAGE_UNITS.find((u) => u.toLowerCase() === lower);
    if (exact) return exact;
    if (lower === 'г' || lower.startsWith('гр')) return 'гр';
    if (lower.startsWith('шт')) return 'шт';
    if (lower.includes('туб')) return 'туба';
    return null;
}

/** Единица для полей фасовки/цен: из сохранённых полей товара или единица учёта каталога. */
export function resolveProductPackageUnit(product: PurchaseProductFieldSource): PackageUnit {
    for (const candidate of [
        product.minPackageUnit,
        product.supplierPackageUnit,
        product.availableUnit,
        product.unit?.shortName,
        product.unit?.name,
    ]) {
        const normalized = normalizePackageUnit(candidate);
        if (normalized) return normalized;
    }
    return PACKAGE_UNITS[0];
}

export function withCatalogPackageUnits<T extends {
    tiers: { unit: string }[];
    supPkgTiers: { unit: string }[];
    minPkgUnit: string;
    availUnit: string;
}>(state: T, catalogUnit: PackageUnit): T {
    return {
        ...state,
        tiers: state.tiers.map((t) => ({ ...t, unit: normalizePackageUnit(t.unit) ?? catalogUnit })),
        supPkgTiers: state.supPkgTiers.map((t) => ({ ...t, unit: normalizePackageUnit(t.unit) ?? catalogUnit })),
        minPkgUnit: normalizePackageUnit(state.minPkgUnit) ?? catalogUnit,
        availUnit: normalizePackageUnit(state.availUnit) ?? catalogUnit,
    };
}

import { parsePriceTiers } from '@zakupki/types';
import { PACKAGE_UNITS, type PackageUnit } from '../../../products/lib';

export type PurchasePriceTier = { amount: number; unit: string; price: number };

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

function isPackageUnit(value: string): value is PackageUnit {
    return (PACKAGE_UNITS as readonly string[]).includes(value);
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

function normalizePackageUnit(raw?: string | null): PackageUnit | null {
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

function withCatalogPackageUnits(
    state: PurchaseProductFormState,
    catalogUnit: PackageUnit,
): PurchaseProductFormState {
    return {
        ...state,
        tiers: state.tiers.map((t) => ({
            ...t,
            unit: normalizePackageUnit(t.unit) ?? catalogUnit,
        })),
        supPkgTiers: state.supPkgTiers.map((t) => ({
            ...t,
            unit: normalizePackageUnit(t.unit) ?? catalogUnit,
        })),
        minPkgUnit: normalizePackageUnit(state.minPkgUnit) ?? catalogUnit,
        availUnit: normalizePackageUnit(state.availUnit) ?? catalogUnit,
    };
}

/** Проверка цен перед сохранением товара в закупке. */
export function validatePurchasePriceTiers(tiers: PurchasePriceTier[]): string | null {
    if (tiers.length === 0) {
        return 'Укажите хотя бы одну цену';
    }
    const hasValid = tiers.some((t) => t.amount > 0 && t.unit.trim() && t.price > 0);
    if (!hasValid) {
        return 'Укажите цену больше 0';
    }
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
    const { supplierPackageAmount, supplierPackageUnit, supplierPackagePrice } =
        normalizeSupplierTiersForSave(tiers);
    return {
        amount: supplierPackageAmount,
        unit: supplierPackageUnit,
        price: supplierPackagePrice,
    };
}

export type PurchaseProductFormState = {
    description: string;
    tiers: PurchasePriceTier[];
    minPkgAmount: number | null;
    minPkgUnit: string;
    supPkgTiers: PurchasePriceTier[];
    availAmount: number | null;
    availUnit: string;
};

const LAST_TEMPLATE_KEY = 'zakupki:last-post-template';

export function templateStorageKey(productId: number) {
    return `zakupki:product-template:${productId}`;
}

/** Шаблон при редактировании в закупке: для товара → последний общий → первый в списке. */
export function resolveDefaultTemplateId(
    productId: number,
    postTemplates: { id: number }[] | undefined,
): string {
    if (!postTemplates?.length) return 'none';
    if (typeof window === 'undefined') return String(postTemplates[0].id);

    const perProduct = sessionStorage.getItem(templateStorageKey(productId));
    if (perProduct === 'none') return 'none';
    if (perProduct && postTemplates.some((t) => String(t.id) === perProduct)) return perProduct;

    const lastUsed = sessionStorage.getItem(LAST_TEMPLATE_KEY);
    if (lastUsed === 'none') return 'none';
    if (lastUsed && postTemplates.some((t) => String(t.id) === lastUsed)) return lastUsed;

    return String(postTemplates[0].id);
}

export function persistTemplateChoice(productId: number, templateId: string) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(templateStorageKey(productId), templateId);
    sessionStorage.setItem(LAST_TEMPLATE_KEY, templateId);
}

export function emptyPurchaseFields(unit?: string): PurchaseProductFormState {
    const u = unit ?? PACKAGE_UNITS[0];
    return {
        description: '',
        tiers: [{ amount: 0, unit: u, price: 0 }],
        minPkgAmount: null,
        minPkgUnit: u,
        supPkgTiers: [{ amount: 0, unit: u, price: 0 }],
        availAmount: null,
        availUnit: u,
    };
}

export function savedPurchaseFields(
    product: PurchaseProductFieldSource,
    initialTiers: PurchasePriceTier[],
): PurchaseProductFormState {
    const catalogUnit = resolveProductPackageUnit(product);
    const tiers =
        initialTiers.length > 0
            ? initialTiers.map((t) => ({
                  amount: Math.max(1, Math.trunc(t.amount)),
                  unit: t.unit,
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
            availAmount: product.availableAmount != null ? Math.trunc(Number(product.availableAmount)) : null,
            availUnit: product.availableUnit ?? catalogUnit,
        },
        catalogUnit,
    );
}

export function buildPurchaseFormState(
    product: PurchaseProductFieldSource,
    initialTiers: PurchasePriceTier[],
    loadSavedDescription: boolean,
): PurchaseProductFormState {
    const catalogUnit = resolveProductPackageUnit(product);
    if (loadSavedDescription) {
        return savedPurchaseFields(product, initialTiers);
    }
    return emptyPurchaseFields(catalogUnit);
}

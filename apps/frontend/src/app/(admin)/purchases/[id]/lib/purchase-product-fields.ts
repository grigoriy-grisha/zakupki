import { PACKAGE_UNITS } from '../../../products/lib';

export type PurchasePriceTier = { amount: number; unit: string; price: number };

export type PurchaseProductFieldSource = {
    description?: string | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplierPackageAmount?: string | number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: string | number | null;
    availableAmount?: string | number | null;
    availableUnit?: string | null;
};

const DEFAULT_TIER: PurchasePriceTier = { amount: 1, unit: PACKAGE_UNITS[0], price: 0 };

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

export type PurchaseProductFormState = {
    description: string;
    tiers: PurchasePriceTier[];
    minPkgAmount: number | null;
    minPkgUnit: string;
    supPkgAmount: number | null;
    supPkgUnit: string;
    supPkgPrice: number | null;
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

export function emptyPurchaseFields(): PurchaseProductFormState {
    return {
        description: '',
        tiers: [{ ...DEFAULT_TIER }],
        minPkgAmount: null,
        minPkgUnit: PACKAGE_UNITS[0],
        supPkgAmount: null,
        supPkgUnit: PACKAGE_UNITS[0],
        supPkgPrice: null,
        availAmount: null,
        availUnit: PACKAGE_UNITS[0],
    };
}

export function savedPurchaseFields(
    product: PurchaseProductFieldSource,
    initialTiers: PurchasePriceTier[],
): PurchaseProductFormState {
    return {
        description: product.description ?? '',
        tiers: initialTiers.length > 0 ? initialTiers : [{ ...DEFAULT_TIER }],
        minPkgAmount: product.minPackageAmount != null ? Number(product.minPackageAmount) : null,
        minPkgUnit: product.minPackageUnit ?? PACKAGE_UNITS[0],
        supPkgAmount: product.supplierPackageAmount != null ? Number(product.supplierPackageAmount) : null,
        supPkgUnit: product.supplierPackageUnit ?? PACKAGE_UNITS[0],
        supPkgPrice: product.supplierPackagePrice != null ? Number(product.supplierPackagePrice) : null,
        availAmount: product.availableAmount != null ? Number(product.availableAmount) : null,
        availUnit: product.availableUnit ?? PACKAGE_UNITS[0],
    };
}

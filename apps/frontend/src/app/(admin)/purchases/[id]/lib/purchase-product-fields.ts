/**
 * Переэкспорт из разбитых модулей для обратной совместимости.
 * Новый код должен импортировать напрямую из package-units, purchase-price-tiers, template-storage.
 */

export {
    isPackageUnit,
    normalizePackageUnit,
    resolveProductPackageUnit,
    withCatalogPackageUnits,
    type PurchaseProductFieldSource,
} from './package-units';

export {
    validatePurchasePriceTiers,
    getInitialSupplierTiers,
    normalizeSupplierTiersForSave,
    primarySupplierPackageFromTiers,
    emptyPurchaseFields,
    savedPurchaseFields,
    buildPurchaseFormState,
    type PurchasePriceTier,
    type PurchaseProductFormState,
} from './purchase-price-tiers';

export {
    templateStorageKey,
    resolveDefaultTemplateId,
    persistTemplateChoice,
} from './template-storage';

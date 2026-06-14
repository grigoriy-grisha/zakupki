export interface DescriptionFields {
    name?: string;
    articleNumber?: string;
    /** Название бренда товара. */
    brandName?: string;
    /** Значения атрибутов для первой строки заголовка (по порядку типов). */
    titleAttributes?: string[];
    /** Все значения атрибутов — для очистки названия. */
    attributeNames?: string[];
    /** Характеристики товара (Цвет: …, Размер: …). */
    productCharacteristics?: { name: string; value: string }[];
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    priceTiers?: { amount?: number; unit?: string; price?: number }[];
    supplierPackageAmount?: number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: number | null;
    supplierPackageTiers?: { amount?: number; unit?: string; price?: number }[];
    /** Глобальный лимит остатка у поставщика (per-purchase). Имеет приоритет
     *  над referenceStock в шаблоне «{{свободно}}». */
    supplierLimit?: number | null;
    supplierLimitUnit?: string | null;
    /** Запасной вариант для «{{свободно}}», если supplierLimit не задан. */
    referenceStock?: number | null;
    referenceStockUnit?: string | null;
    purchaseTag?: string;
    /** Скидка за целую пачку бисера, % (из настроек). */
    packDiscountPercent?: number | null;
}

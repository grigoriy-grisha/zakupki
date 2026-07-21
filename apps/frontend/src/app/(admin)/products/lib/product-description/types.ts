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
    /** Глобальный лимит остатка у поставщика (per-purchase). Используется
     *  в шаблоне «{{свободно}}». */
    supplierLimit?: number | null;
    supplierLimitUnit?: string | null;
    /** Имя поставщика (per-purchase). Используется в шаблоне «{{поставщик}}». */
    supplierName?: string;
    purchaseTag?: string;
    /** Скидка за целую пачку, % (из настроек). */
    packDiscountPercent?: number | null;
    // Новая модель цен (валюта + курс + оргсбор):
    /** Цена за упаковку в выбранной валюте. */
    pricePerPackCurrency?: number | null;
    /** Имя валюты (для отображения в шаблоне «{{цена за пачку}}»). */
    currencyName?: string;
    /** Вес упаковки (packAmount). */
    packAmount?: number | null;
    /** Единица веса упаковки (гр/шт/туба). */
    packUnit?: string | null;
    /** Применённый % оргсбора. */
    orgFeePercent?: number | null;
}

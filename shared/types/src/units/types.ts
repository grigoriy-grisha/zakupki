/**
 * Тип единицы измерения
 * WEIGHT — весовые товары (граммы) и штучные с фасовкой (piece_pack)
 * PIECE — штучные товары (штуки, тубы)
 */
export type UnitKind = 'WEIGHT' | 'PIECE';

/** Коды единиц, допустимые в БД (Product.unitCode / PurchaseItem.unitCode). */
export const PRODUCT_UNIT_CODES = ['gram', 'piece', 'tube', 'piece_pack'] as const;

export type ProductUnitCode = (typeof PRODUCT_UNIT_CODES)[number];

/**
 * Определение единицы измерения
 */
export type UnitDef = {
    /** Уникальный код единицы (например, 'gram', 'piece', 'tube') */
    code: string;
    /** Полное название (например, 'Граммы', 'Штуки', 'Туба') */
    name: string;
    /** Краткое обозначение (например, 'гр', 'шт', 'туба') */
    shortName: string;
    /** Формы для плюрализации с числом: [1, 2, 5] — «туба», «тубы», «туб» */
    pluralForms: readonly [string, string, string];
    /** Тип единицы: WEIGHT или PIECE */
    kind: UnitKind;
    prepositional: string;
    /** Варианты написания для нормализации (lowercase) */
    aliases: string[];
};

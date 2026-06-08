/**
 * Тип единицы измерения
 * WEIGHT — весовые товары (граммы, килограммы)
 * PIECE — штучные товары (штуки, тубы)
 */
export type UnitKind = 'WEIGHT' | 'PIECE';

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
    /** Тип единицы: WEIGHT или PIECE */
    kind: UnitKind;
    /** Варианты написания для нормализации (lowercase) */
    aliases: string[];
};

import type { UnitDef } from './types';

/**
 * Реестр единиц измерения
 * Содержит все доступные единицы с их свойствами
 */
export const UNITS: readonly UnitDef[] = [
    {
        code: 'gram',
        name: 'Граммы',
        shortName: 'гр',
        kind: 'WEIGHT',
        aliases: ['гр', 'г', 'g', 'грамм', 'gram', 'grams'],
    },
    {
        code: 'piece',
        name: 'Штуки',
        shortName: 'шт',
        kind: 'PIECE',
        aliases: ['шт', 'штука', 'штук', 'piece', 'pieces'],
    },
    {
        code: 'tube',
        name: 'Туба',
        shortName: 'туба',
        kind: 'PIECE',
        aliases: ['туба', 'туб', 'tube', 'тубус', 'tubus'],
    },
] as const;

/**
 * Получить определение единицы по коду
 */
export function getUnitByCode(code: string): UnitDef | undefined {
    return UNITS.find((unit) => unit.code === code);
}

/**
 * Получить определение единицы по краткому названию
 */
export function getUnitByShortName(shortName: string): UnitDef | undefined {
    return UNITS.find((unit) => unit.shortName === shortName);
}

/**
 * Резолвить строку в определение единицы
 * Проверяет code, shortName и aliases (case-insensitive)
 */
export function resolveUnit(raw: string | null | undefined): UnitDef | undefined {
    if (!raw) return undefined;

    const normalized = raw.trim().toLowerCase();
    if (!normalized) return undefined;

    // Проверка по code
    const byCode = UNITS.find((unit) => unit.code.toLowerCase() === normalized);
    if (byCode) return byCode;

    // Проверка по shortName
    const byShortName = UNITS.find((unit) => unit.shortName.toLowerCase() === normalized);
    if (byShortName) return byShortName;

    // Проверка по aliases
    for (const unit of UNITS) {
        if (unit.aliases.includes(normalized)) {
            return unit;
        }
    }

    return undefined;
}

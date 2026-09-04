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
        pluralForms: ['гр', 'гр', 'гр'],
        kind: 'WEIGHT',
        aliases: ['гр', 'г', 'g', 'грамм', 'gram', 'grams'],
    },
    {
        code: 'piece',
        name: 'Штуки',
        shortName: 'шт',
        pluralForms: ['шт', 'шт', 'шт'],
        kind: 'PIECE',
        aliases: ['шт', 'штука', 'штук', 'piece', 'pieces'],
    },
    {
        code: 'tube',
        name: 'Туба',
        shortName: 'туба',
        pluralForms: ['туба', 'тубы', 'туб'],
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

/** Форма единицы для числа: 1 туба / 2 тубы / 27 туб */
export function unitPluralForm(quantity: number, def: UnitDef): string {
    const mod10 = Math.abs(quantity) % 10;
    const mod100 = Math.abs(quantity) % 100;
    if (mod10 === 1 && mod100 !== 11) return def.pluralForms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return def.pluralForms[1];
    return def.pluralForms[2];
}

/** «18 туб» / «1 туба»: число + плюрализованная единица. Неизвестная единица — как есть. */
export function formatQtyUnit(quantity: number, rawUnit: string | null | undefined): string {
    const def = resolveUnit(rawUnit);
    const word = def ? unitPluralForm(quantity, def) : rawUnit;
    const formatted = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
    return word ? `${formatted} ${word}` : formatted;
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

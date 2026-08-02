import { resolveUnit } from './registry';

/**
 * Проверить, является ли единица весовой (WEIGHT)
 */
export function isWeightUnit(raw: string | null | undefined): boolean {
    return resolveUnit(raw)?.kind === 'WEIGHT';
}

/**
 * Проверить, является ли единица штучной (PIECE)
 */
export function isPieceUnit(raw: string | null | undefined): boolean {
    return resolveUnit(raw)?.kind === 'PIECE';
}

/**
 * Нормализовать строку в код единицы
 * Возвращает null если единица не распознана
 */
export function normalizeUnitCode(raw: string | null | undefined): string | null {
    return resolveUnit(raw)?.code ?? null;
}

/**
 * Нормализовать строку в краткое название единицы
 * Возвращает null если единица не распознана
 */
export function normalizeUnitShortName(raw: string | null | undefined): string | null {
    return resolveUnit(raw)?.shortName ?? null;
}

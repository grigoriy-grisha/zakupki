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

/**
 * Apply piece-unit invariants to a save request in place: piece goods have no
 * supplier packaging, so pack size is forced to 1 and pack-derived fields are
 * dropped. Only touches fields carried by the request itself — never rewrites
 * existing state of items the request did not mention.
 */
export function applyPieceUnitInvariants(
    unitCode: string | null | undefined,
    fields: {
        packAmount?: unknown;
        minPackageAmount?: unknown;
        supplementStep?: unknown;
    },
): void {
    if (!isPieceUnit(unitCode ?? null)) return;
    if (fields.packAmount !== undefined) fields.packAmount = 1;
    if (fields.minPackageAmount !== undefined) fields.minPackageAmount = null;
    if (fields.supplementStep !== undefined) fields.supplementStep = null;
}

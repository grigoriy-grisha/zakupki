import { isPieceUnit } from '../units/normalize';
import type { OrderQuantityOptions } from './types';
import { positiveOrNull } from '../utils';

const DEFAULT_STEP_BY_UNIT: Record<string, number> = {
    gram: 5,
};

export function getOrderQuantityStep(options: OrderQuantityOptions): number {
    if (isPieceUnit(options.unitCode)) {
        return multiplicityStepOrNull(options.multiplicity) ?? 1;
    }
    return (
        positiveOrNull(options.minPackageAmount) ??
        multiplicityStepOrNull(options.multiplicity) ??
        defaultStepForUnit(options.unitCode)
    );
}

/** multiplicity > 1 — реальная кратность шага; 1 или меньше — игнорируем. */
function multiplicityStepOrNull(value: number | null | undefined): number | null {
    const n = positiveOrNull(value);
    return n != null && n > 1 ? n : null;
}

function defaultStepForUnit(unitCode: string | null | undefined): number {
    if (!unitCode) return 1;
    return DEFAULT_STEP_BY_UNIT[unitCode] ?? 1;
}

export function getSupplementStep(input: {
    fulfillmentStatus: string;
    supplementStep: number | null;
    regularStep: number;
}): number {
    if (input.fulfillmentStatus === 'COLLECTION') return input.regularStep;
    return input.supplementStep ?? input.regularStep;
}

export function getActiveStep(input: {
    fulfillmentStatus: string;
    options: OrderQuantityOptions;
    supplementStep: number | null;
}): number {
    const regularStep = getOrderQuantityStep(input.options);
    const piece = isPieceUnit(input.options.unitCode);
    return getSupplementStep({
        fulfillmentStatus: input.fulfillmentStatus,
        supplementStep: piece ? null : input.supplementStep,
        regularStep,
    });
}

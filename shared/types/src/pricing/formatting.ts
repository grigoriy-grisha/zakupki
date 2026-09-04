import { formatQtyLabel, positiveOrNull } from '../utils';
import { isSupplementPhase } from '../order-strategies';
import { isPieceUnit } from '../units/normalize';

export function formatActiveStepHint(input: {
    fulfillmentStatus: string;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplementStep: number | null;
    unitShort: string;
    unitCode?: string | null;
}): string | null {
    if (isPieceUnit(input.unitCode ?? null)) return null;
    const isSupplement = isSupplementPhase(input.fulfillmentStatus);
    const regularStep = positiveOrNull(input.minPackageAmount);
    const step = isSupplement ? positiveOrNull(input.supplementStep) ?? regularStep : regularStep;
    if (step == null) return null;
    const unit = input.minPackageUnit ?? input.unitShort ?? 'ед.';
    const label = isSupplement ? 'Шаг добора' : 'Мин. фасовка';
    return `${label}: ${formatQtyLabel(step)} ${unit}`;
}

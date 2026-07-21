import { formatQtyLabel, positiveOrNull } from '../utils';
import { isSupplementPhase } from '../order-strategies';

/**
 * Stage-aware подсказка шага для UI: учитывает текущий этап закупки.
 *
 * На COLLECTION показывает «Мин. фасовка: N ед» (regular step = minPackageAmount).
 * На REORDER/PAYMENT+ показывает «Шаг добора: N ед», где N = supplementStep,
 * если задан, иначе fallback на minPackageAmount (та же логика, что в getSupplementStep).
 *
 * Признак этапа добора берётся из общего isSupplementPhase (используется и в
 * getSupplementStep-окружении, и в order-strategies) — единый source of truth.
 *
 * Возвращает null если шаг нельзя показать (например, оба значения null).
 */
export function formatActiveStepHint(input: {
    fulfillmentStatus: string;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    supplementStep: number | null;
    unitShort: string;
}): string | null {
    const isSupplement = isSupplementPhase(input.fulfillmentStatus);
    const regularStep = positiveOrNull(input.minPackageAmount);
    const step = isSupplement ? positiveOrNull(input.supplementStep) ?? regularStep : regularStep;
    if (step == null) return null;
    const unit = input.minPackageUnit ?? input.unitShort ?? 'ед.';
    const label = isSupplement ? 'Шаг добора' : 'Мин. фасовка';
    return `${label}: ${formatQtyLabel(step)} ${unit}`;
}

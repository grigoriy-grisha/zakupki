import type { OrderQuantityOptions } from './types';
import { positiveOrNull } from '../utils';

/**
 * Дефолтный шаг по единице учёта, когда ни minPackageAmount, ни multiplicity
 * не заданы. Граммы по умолчанию шагают по 5 (бизнес-конвенция: бисер/фурнитура
 * в граммах обычно фасуется кратно 5). Для штучных единиц (piece, tube) — 1.
 *
 * Добавляйте сюда дефолты для новых единиц по мере необходимости.
 */
const DEFAULT_STEP_BY_UNIT: Record<string, number> = {
    gram: 5,
};

/**
 * Шаг заказа: мин. фасовка товара → иначе кратность (если > 1) → иначе дефолт
 * по единице учёта (gram → 5) → иначе 1.
 *
 * multiplicity === 1 трактуется как «не задано»: кратность 1 не накладывает
 * ограничений (любое число кратно 1), а Product.multiplicity имеет дефолт 1
 * в схеме — поэтому без этой проверки gram-дефолт никогда бы не срабатывал.
 */
export function getOrderQuantityStep(options: OrderQuantityOptions): number {
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

/** Дефолтный шаг для единицы учёта (по unitCode). 1 если единица неизвестна. */
function defaultStepForUnit(unitCode: string | null | undefined): number {
    if (!unitCode) return 1;
    return DEFAULT_STEP_BY_UNIT[unitCode] ?? 1;
}

/**
 * Шаг для кнопок +/− на текущем этапе.
 * - COLLECTION: обычная фасовка (minPackageAmount / multiplicity)
 * - REORDER+: supplementStep если задан, иначе обычная фасовка
 */
export function getSupplementStep(input: {
    fulfillmentStatus: string;
    supplementStep: number | null;
    regularStep: number;
}): number {
    if (input.fulfillmentStatus === 'COLLECTION') return input.regularStep;
    return input.supplementStep ?? input.regularStep;
}

/**
 * Полный шаг на текущем этапе: считает regularStep из options через
 * getOrderQuantityStep и применяет getSupplementStep. Единая точка для UI/бота/
 * домена — устраняет дублирование паттерна «regularStep → supplementStep».
 */
export function getActiveStep(input: {
    fulfillmentStatus: string;
    options: OrderQuantityOptions;
    supplementStep: number | null;
}): number {
    const regularStep = getOrderQuantityStep(input.options);
    return getSupplementStep({
        fulfillmentStatus: input.fulfillmentStatus,
        supplementStep: input.supplementStep,
        regularStep,
    });
}

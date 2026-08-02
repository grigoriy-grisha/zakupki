import { formatActiveStepHint } from '@zakupki/types';

/**
 * Минимальная форма PurchaseItem-подобного объекта для шагового хинта.
 * Берётся только то, что реально нужно — три опциональных поля шага.
 */
export interface StepHintSource {
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
    supplementStep?: string | number | null;
}

/**
 * Извлекает шаг-поля из PurchaseItem-подобного объекта и формирует stage-aware
 * хинт через общий formatActiveStepHint.
 *
 * Устраняет дублирование Number-приведений и форму аргумента между
 * product-card.tsx и item/[itemId]/page.tsx — оба вызывают этот хелпер,
 * передавая «сырой» item как есть.
 */
export function buildStepHint(
    item: StepHintSource,
    fulfillmentStatus: string,
    unitShort: string,
): string | null {
    return formatActiveStepHint({
        fulfillmentStatus,
        minPackageAmount: item.minPackageAmount != null ? Number(item.minPackageAmount) : null,
        minPackageUnit: item.minPackageUnit ?? null,
        supplementStep: item.supplementStep != null ? Number(item.supplementStep) : null,
        unitShort,
    });
}

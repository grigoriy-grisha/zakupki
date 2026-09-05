'use client';

import { getUnitShortName, isWeightUnit, splitQtyIntoPackages } from '@zakupki/types';
import { BoxIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuantityDisplayProps {
    /** Сумма quantity всех строк (россыпь, без упаковок). */
    totalQty: number;
    /** Сумма packageCount всех строк (явные упаковки). */
    packageCount: number;
    /** Вес упаковки в базовых единицах (гр/шт). null — упаковок нет. */
    packAmount?: string | number | null;
    /** Код единицы товара ('gram' | 'piece' | 'tube'). */
    unitCode?: string | null;
    className?: string;
}

/**
 * Отображение объединённого количества товара: общее пересчитывается в
 * целые упаковки + остаток, и итог на отдельной строке.
 *
 *  - `effective = totalQty + packageCount × packAmount` — суммарный вес/шт;
 *  - `splitQtyIntoPackages(effective, packSize)` — «сколько это целых пачек + остаток».
 *
 * Примеры (пачка 50):
 *  - россыпь 70 + 1 уп → effective 120 → «2 уп + 20 гр» / «всего 120 гр»;
 *  - россыпь 60 + 1 уп → effective 110 → «2 уп + 10 гр» / «всего 110 гр»;
 *  - россыпь 50, без явных пачек → effective 50 → «1 уп» (без «всего»).
 *
 * Штучные товары (piece/tube): просто «N шт» — упаковки для них не имеют смысла.
 */
export function QuantityDisplay({
    totalQty,
    packageCount,
    packAmount,
    unitCode,
    className,
}: QuantityDisplayProps) {
    const packSize = packAmount != null ? Number(packAmount) : null;
    const hasValidPackSize = packSize != null && packSize > 0 && Number.isFinite(packSize);
    const isWeight = isWeightUnit(unitCode ?? null);
    // Unknown/missing unit renders as «ед.» — never silently «шт».
    const unit = getUnitShortName(unitCode ?? '');

    // Суммарное количество в базовых единицах (россыпь + явные упаковки × packSize).
    const effective =
        hasValidPackSize && packageCount > 0 ? totalQty + packageCount * packSize! : totalQty;

    // Пересчёт общего количества в целые пачки + остаток-россыпь.
    const { packs, remainder } = hasValidPackSize
        ? splitQtyIntoPackages(effective, packSize)
        : { packs: 0, remainder: effective };

    const showPackages = isWeight && hasValidPackSize && packs > 0;
    const main = showPackages
        ? remainder > 0
            ? `${packs} уп + ${remainder} ${unit}`
            : `${packs} уп`
        : `${effective} ${unit}`;

    // «Всего» — только когда есть и пачки, и остаток (иначе main = итогу).
    const showTotalLine = showPackages && remainder > 0;

    return (
        <div className={cn('flex flex-col gap-0.5', className)}>
            <p className="flex items-center gap-1 text-12-medium text-fg-secondary">
                {showPackages && <BoxIcon className="size-3.5 text-secondary" />}
                <span className="tabular-nums">{main}</span>
            </p>
            {showTotalLine && (
                <p className="text-12-regular text-fg-tertiary tabular-nums">
                    всего {effective} {unit}
                </p>
            )}
        </div>
    );
}

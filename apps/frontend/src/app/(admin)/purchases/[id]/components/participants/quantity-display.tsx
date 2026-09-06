'use client';

import { buildQuantityDisplay } from '@zakupki/types';
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

export function QuantityDisplay({
    totalQty,
    packageCount,
    packAmount,
    unitCode,
    className,
}: QuantityDisplayProps) {
    const packSize = packAmount != null ? Number(packAmount) : null;
    const { main, total } = buildQuantityDisplay({
        quantity: totalQty,
        packageCount,
        packSize: packSize != null && Number.isFinite(packSize) ? packSize : null,
        unitCode: unitCode ?? null,
    });
    const hasPackages = packageCount > 0 && main.includes('уп');

    return (
        <div className={cn('flex flex-col gap-0.5', className)}>
            <p className="flex items-center gap-1 text-12-medium text-fg-secondary">
                {hasPackages && <BoxIcon className="size-3.5 text-secondary" />}
                <span className="tabular-nums">{main}</span>
            </p>
            {total && (
                <p className="text-12-regular text-fg-tertiary tabular-nums">{total}</p>
            )}
        </div>
    );
}

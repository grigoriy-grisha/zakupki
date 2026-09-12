'use client';

import { UNITS } from '@zakupki/types';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Short-имена единиц из registry: «гр», «шт», «туба». Без дублей —
 * у piece и piece_pack одинаковый shortName «шт», в суффиксных селекторах
 * (packUnit, мин. фасовка) они неотличимы. */
const PACKAGE_UNITS = [...new Set(UNITS.map((u) => u.shortName))];

export interface PackageUnitOption {
    value: string;
    label: string;
}

/**
 * Компактный Select единицы измерения из registry (гр/шт/туба).
 * Используется и в каталоге товаров, и в позициях закупки (packUnit).
 * Значение — shortName единицы («гр», «шт», «туба»); options позволяет
 * подменить список (например, в «Единица товара» значения — коды единиц).
 */
export function PackageUnitSelect({
    value,
    onChange,
    className,
    options,
}: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
    options?: readonly PackageUnitOption[];
}) {
    const list = options ?? PACKAGE_UNITS.map((u) => ({ value: u, label: u }));
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger size="sm" className={cn('min-w-20', className)}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {list.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

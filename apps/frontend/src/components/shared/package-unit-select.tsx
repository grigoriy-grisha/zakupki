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

/** Short-имена единиц из registry: «гр», «шт», «туба». */
const PACKAGE_UNITS = UNITS.map((u) => u.shortName);

/**
 * Компактный Select единицы измерения из registry (гр/шт/туба).
 * Используется и в каталоге товаров, и в позициях закупки (packUnit).
 * Значение — shortName единицы («гр», «шт», «туба»).
 */
export function PackageUnitSelect({
    value,
    onChange,
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger size="sm" className={cn('min-w-20', className)}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {PACKAGE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                        {u}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

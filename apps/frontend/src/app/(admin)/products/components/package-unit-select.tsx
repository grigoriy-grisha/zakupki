'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PACKAGE_UNITS } from '../lib';

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

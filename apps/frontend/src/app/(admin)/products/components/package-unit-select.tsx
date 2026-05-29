'use client';

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
        <select
            className={cn(
                'h-9 rounded-md border border-input bg-background px-2 text-sm',
                className,
            )}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {PACKAGE_UNITS.map((u) => (
                <option key={u} value={u}>
                    {u}
                </option>
            ))}
        </select>
    );
}

'use client';

import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { PackageUnitSelect } from '../../../../../../products/components/package-unit-select';
import { PACKAGE_UNITS } from '../../../../../../products/lib';

interface MinPackageSectionProps {
    minPkgAmount: number | null;
    minPkgUnit: string | null;
    onAmountChange: (value: number | null) => void;
    onUnitChange: (value: string | null) => void;
}

export function MinPackageSection({
    minPkgAmount,
    minPkgUnit,
    onAmountChange,
    onUnitChange,
}: MinPackageSectionProps) {
    return (
        <FormSection card title="Минимальная фасовка">
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    step="1"
                    min={0}
                    inputMode="numeric"
                    className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                    value={minPkgAmount != null ? String(Math.trunc(minPkgAmount)) : ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onAmountChange(raw === '' ? null : Number.parseInt(raw, 10) || 0);
                    }}
                    aria-label="Минимальная фасовка"
                />
                <PackageUnitSelect value={minPkgUnit ?? PACKAGE_UNITS[0]} onChange={onUnitChange} />
            </div>
            <p className="text-12-regular text-fg-tertiary">
                Шаг +/− на этапе сбора. Например: 5 гр — заказ кратен 5.
            </p>
        </FormSection>
    );
}

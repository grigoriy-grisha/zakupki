'use client';

import { FormSection } from '@/components/ui/form-section';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PackageEditor } from '../../../../../../products/components/package-fields';
import { PackageUnitSelect } from '../../../../../../products/components/package-unit-select';
import { PACKAGE_UNITS } from '../../../../../../products/lib';

interface SupplementLimitsSectionProps {
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string | null;
    targetRemainder: number | null;
    minPkgUnit: string | null;
    onSupplementStepChange: (v: number | null) => void;
    onSupplierLimitChange: (v: number | null) => void;
    onSupplierLimitUnitChange: (v: string | null) => void;
    onMinPkgUnitChange: (v: string | null) => void;
    onTargetRemainderChange: (v: number | null) => void;
}

export function SupplementLimitsSection({
    supplementStep,
    supplierLimit,
    supplierLimitUnit,
    targetRemainder,
    minPkgUnit,
    onSupplementStepChange,
    onSupplierLimitChange,
    onSupplierLimitUnitChange,
    onMinPkgUnitChange,
    onTargetRemainderChange,
}: SupplementLimitsSectionProps) {
    return (
        <FormSection card title="Добор и лимиты">
            <FormField
                label="Шаг добора"
                hint="Шаг +/− на этапе добора. Если не задан — используется мин. фасовка"
            >
                <div className="flex items-center gap-2">
                    <Input
                        id="supplementStep"
                        type="number"
                        step="0.001"
                        min={0}
                        placeholder="По умолчанию (мин. фасовка)"
                        className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                        value={supplementStep != null ? String(supplementStep) : ''}
                        onChange={(e) =>
                            onSupplementStepChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                    />
                    <PackageUnitSelect
                        value={minPkgUnit ?? PACKAGE_UNITS[0]}
                        onChange={onMinPkgUnitChange}
                    />
                </div>
            </FormField>

            <PackageEditor
                label="Лимит у поставщика (на всех покупателей)"
                amount={supplierLimit}
                unit={supplierLimitUnit ?? PACKAGE_UNITS[0]}
                onAmountChange={onSupplierLimitChange}
                onUnitChange={onSupplierLimitUnitChange}
                description="Суммарно все покупатели не могут заказать больше этого количества ни на одном этапе. Если не задан — без ограничений."
            />

            <FormField
                label="Целевой остаток (добор)"
                hint="Сколько ещё нужно добрать у поставщика на этапе REORDER. Оставьте пустым, если добор не нужен."
            >
                <Input
                    id="targetRemainder"
                    type="number"
                    step="0.001"
                    min={0}
                    placeholder="0"
                    className="h-9 w-32 rounded-xl text-13-medium tabular-nums"
                    value={targetRemainder != null ? String(targetRemainder) : ''}
                    onChange={(e) =>
                        onTargetRemainderChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                />
            </FormField>
        </FormSection>
    );
}

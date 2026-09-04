'use client';

import { resolveUnit } from '@zakupki/types';

import { PACKAGE_UNITS } from '@/app/(admin)/products/lib';
import { PackageUnitSelect } from '@/components/shared/package-unit-select';
import { FormField } from '@/components/ui/form-field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';

import { PackageEditor } from './package-fields';

interface SupplementLimitsSectionProps {
    unit: string;
    minPackageAmount: number | null;
    supplementStep: number | null;
    supplierLimit: number | null;
    supplierLimitUnit: string | null;
    targetRemainder: number | null;
    minPkgUnit: string | null;
    onMinPackageAmountChange: (v: number | null) => void;
    onSupplementStepChange: (v: number | null) => void;
    onSupplierLimitChange: (v: number | null) => void;
    onSupplierLimitUnitChange: (v: string | null) => void;
    onMinPkgUnitChange: (v: string | null) => void;
    onTargetRemainderChange: (v: number | null) => void;
}

export function SupplementLimitsSection({
    unit,
    minPackageAmount,
    supplementStep,
    supplierLimit,
    supplierLimitUnit,
    targetRemainder,
    minPkgUnit,
    onMinPackageAmountChange,
    onSupplementStepChange,
    onSupplierLimitChange,
    onSupplierLimitUnitChange,
    onMinPkgUnitChange,
    onTargetRemainderChange,
}: SupplementLimitsSectionProps) {
    const isWeight = resolveUnit(unit)?.kind === 'WEIGHT';

    return (
        <FormSection card title="Добор и лимиты">
            {isWeight && (
                <>
                    <FormField
                        label="Мин. фасовка (шаг сбора)"
                        hint="Шаг +/− на этапе сбора. Если не задан — шаг = 1. Используется как запас для шага добора, если он не задан"
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                id="minPackageAmount"
                                type="number"
                                step="0.001"
                                min={0}
                                placeholder="По умолчанию (1)"
                                className="h-9 w-24 shrink-0 rounded-xl text-13-medium tabular-nums"
                                value={minPackageAmount != null ? String(minPackageAmount) : ''}
                                onChange={(e) =>
                                    onMinPackageAmountChange(e.target.value === '' ? null : Number(e.target.value))
                                }
                            />
                            <PackageUnitSelect value={minPkgUnit ?? PACKAGE_UNITS[0]} onChange={onMinPkgUnitChange} />
                        </div>
                    </FormField>

                    <FormField
                        label="Шаг добора"
                        hint="Шаг +/− на этапе добора. Если не задан — используется мин. фасовка"
                    >
                        <Input
                            id="supplementStep"
                            type="number"
                            step="0.001"
                            min={0}
                            placeholder="По умолчанию (мин. фасовка)"
                            className="h-9 w-24 rounded-xl text-13-medium tabular-nums"
                            value={supplementStep != null ? String(supplementStep) : ''}
                            onChange={(e) => onSupplementStepChange(e.target.value === '' ? null : Number(e.target.value))}
                        />
                    </FormField>
                </>
            )}

            <PackageEditor
                label="Лимит у поставщика (на всех покупателей)"
                amount={supplierLimit}
                unit={supplierLimitUnit ?? unit}
                onAmountChange={onSupplierLimitChange}
                onUnitChange={onSupplierLimitUnitChange}
                lockUnit={!isWeight}
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
                    onChange={(e) => onTargetRemainderChange(e.target.value === '' ? null : Number(e.target.value))}
                />
            </FormField>
        </FormSection>
    );
}

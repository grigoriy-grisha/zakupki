'use client';

import { FormSection } from '@/components/ui/form-section';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PackageEditor } from '../../../../../../products/components/package-fields';
import { PackageUnitSelect } from '../../../../../../products/components/package-unit-select';
import { PACKAGE_UNITS } from '../../../../../../products/lib';

/**
 * Sensible defaults when the admin picks grams as the package unit. Grams are
 * a bulk unit where a step of 1 is almost always wrong (nobody orders 1 gram
 * of tea); 5 g min packaging and 10 g reorder step match how organic small-batch
 * purchasing actually works in this domain. Only applied the moment the unit
 * switches to «гр» — the admin can still override afterwards, and switching
 * back to another unit does NOT reset the values.
 */
const GRAM_DEFAULT_MIN_PACKAGE = 5;
const GRAM_DEFAULT_SUPPLEMENT_STEP = 10;
const GRAM_UNIT = 'гр';

interface SupplementLimitsSectionProps {
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
    // On switching the unit to grams, prefill min package and supplement step
    // with domain-sensible defaults. Pass-through for any other unit, so the
    // admin's previously typed values survive a unit roundtrip.
    const handleMinPkgUnitChange = (v: string | null) => {
        onMinPkgUnitChange(v);
        if (v === GRAM_UNIT) {
            onMinPackageAmountChange(GRAM_DEFAULT_MIN_PACKAGE);
            onSupplementStepChange(GRAM_DEFAULT_SUPPLEMENT_STEP);
        }
    };

    return (
        <FormSection card title="Добор и лимиты">
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
                    <PackageUnitSelect
                        value={minPkgUnit ?? PACKAGE_UNITS[0]}
                        onChange={handleMinPkgUnitChange}
                    />
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
                    onChange={(e) =>
                        onSupplementStepChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                />
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

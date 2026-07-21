'use client';

import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface QuantityButtonsProps {
    /** Шаг кнопок ± (мин. фасовка или supplementStep) */
    activeStep: number;
    /** Короткое название единицы (гр, шт) */
    shortName: string;
    canAdd: boolean;
    canDecrease: boolean;
    onAdd: () => void;
    onRemove: () => void;
    isPending: boolean;

    // Пакеты
    showPackage: boolean;
    /** Можно ли добавить упаковку (только supplierLimit, не пул). */
    canAddPackage?: boolean;
    packSize: number | null;
    packageCount: number;
    onAddPackage: () => void;
    onRemovePackage: () => void;

    /** sm = карточка, md = модалка/деталь */
    size?: 'sm' | 'md';
}

export function QuantityButtons({
    activeStep,
    shortName,
    canAdd,
    canDecrease,
    onAdd,
    onRemove,
    isPending,
    showPackage,
    canAddPackage = true,
    packSize,
    packageCount,
    onAddPackage,
    onRemovePackage,
    size = 'sm',
}: QuantityButtonsProps) {
    const isMd = size === 'md';
    const btnSize = isMd ? 'default' : 'sm';
    const btnCls = isMd ? 'min-w-0 flex-1 text-14-medium' : 'min-w-0 flex-1 text-12-medium';
    const iconCls = isMd ? 'mr-1 size-4' : 'mr-1 size-3';
    const rowCls = isMd ? 'mx-auto grid max-w-xs grid-cols-2 gap-3' : 'flex gap-1.5';

    return (
        <>
            {/* ±мин.фасовка */}
            <div className={rowCls}>
                <Button
                    variant="outline"
                    size={btnSize}
                    className={btnCls}
                    disabled={!canDecrease}
                    onClick={onRemove}
                >
                    <Minus className={iconCls} />−{activeStep} {shortName}
                </Button>
                <Button
                    variant="outline"
                    size={btnSize}
                    className={btnCls}
                    disabled={!canAdd}
                    onClick={onAdd}
                >
                    <Plus className={iconCls} />+{activeStep} {shortName}
                </Button>
            </div>

            {/* ±упаковка поставщика */}
            {showPackage && (
                <div className={rowCls}>
                    <Button
                        variant="outline"
                        size={btnSize}
                        className={btnCls}
                        disabled={isPending || packageCount <= 0}
                        onClick={onRemovePackage}
                    >
                        <Minus className={iconCls} />
                        −Упак.
                    </Button>
                    <Button
                        variant="outline"
                        size={btnSize}
                        className={btnCls}
                        disabled={isPending || !canAddPackage}
                        onClick={onAddPackage}
                    >
                        <Plus className={iconCls} />
                        +Упак. {packSize != null && `(${packSize} ${shortName})`}
                    </Button>
                </div>
            )}
        </>
    );
}

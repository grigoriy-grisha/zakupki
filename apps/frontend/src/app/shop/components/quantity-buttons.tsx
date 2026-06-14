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
    packSize,
    packageCount,
    onAddPackage,
    onRemovePackage,
    size = 'sm',
}: QuantityButtonsProps) {
    const cls = size === 'sm' ? 'h-9 flex-1 text-xs' : 'h-12 flex-1 text-sm font-medium rounded-xl';

    return (
        <>
            {/* ±мин.фасовка */}
            <div className={size === 'sm' ? 'flex gap-1.5' : 'mx-auto grid max-w-xs grid-cols-2 gap-3'}>
                <Button
                    variant="outline"
                    size={size === 'sm' ? 'sm' : 'default'}
                    className={cls}
                    disabled={!canDecrease}
                    onClick={onRemove}
                >
                    <Minus className={size === 'sm' ? 'mr-1 h-3 w-3' : 'mr-1 h-4 w-4'} />−{activeStep} {shortName}
                </Button>
                <Button
                    variant="outline"
                    size={size === 'sm' ? 'sm' : 'default'}
                    className={cls}
                    disabled={!canAdd}
                    onClick={onAdd}
                >
                    <Plus className={size === 'sm' ? 'mr-1 h-3 w-3' : 'mr-1 h-4 w-4'} />+{activeStep} {shortName}
                </Button>
            </div>

            {/* ±упаковка поставщика */}
            {showPackage && (
                <div className={size === 'sm' ? 'flex gap-1.5' : 'mx-auto grid max-w-xs grid-cols-2 gap-3'}>
                    <Button
                        variant="outline"
                        size={size === 'sm' ? 'sm' : 'default'}
                        className={cls}
                        disabled={isPending || packageCount <= 0}
                        onClick={onRemovePackage}
                    >
                        <Minus className={size === 'sm' ? 'mr-1 h-3 w-3' : 'mr-1 h-4 w-4'} />
                        {size === 'sm' ? '−Упак.' : '−Упак.'}
                    </Button>
                    <Button
                        variant="outline"
                        size={size === 'sm' ? 'sm' : 'default'}
                        className={cls}
                        disabled={isPending}
                        onClick={onAddPackage}
                    >
                        <Plus className={size === 'sm' ? 'mr-1 h-3 w-3' : 'mr-1 h-4 w-4'} />
                        {size === 'sm' ? `+Упак.` : `+Упак.`} {packSize != null && `(${packSize} ${shortName})`}
                    </Button>
                </div>
            )}
        </>
    );
}

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CharacteristicField = { id: number; name: string };

interface ProductCharacteristicsFieldsProps {
    fields: CharacteristicField[];
    values: Record<number, string>;
    showOnCard?: Record<number, boolean>;
    onChange: (characteristicId: number, value: string) => void;
    onShowOnCardChange?: (characteristicId: number, show: boolean) => void;
    title?: React.ReactNode;
}

export function ProductCharacteristicsFields({
    fields,
    values,
    showOnCard,
    onChange,
    onShowOnCardChange,
    title = 'Характеристики',
}: ProductCharacteristicsFieldsProps) {
    if (fields.length === 0) return null;

    return (
        <div className="space-y-3">
            {title != null && <Label>{title}</Label>}
            {fields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`char-${field.id}`} className="text-fg-secondary">
                            {field.name}
                        </Label>
                        {onShowOnCardChange && (
                            <label className="flex cursor-pointer items-center gap-1.5 text-11-regular text-fg-tertiary">
                                <Checkbox
                                    checked={showOnCard?.[field.id] ?? false}
                                    onCheckedChange={(v) => onShowOnCardChange(field.id, v === true)}
                                />
                                на карточке
                            </label>
                        )}
                    </div>
                    <Input
                        id={`char-${field.id}`}
                        value={values[field.id] ?? ''}
                        onChange={(e) => onChange(field.id, e.target.value)}
                    />
                </div>
            ))}
        </div>
    );
}

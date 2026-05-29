'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CharacteristicMultiPicker } from '@/components/shared/characteristic-multi-picker';

export type CharacteristicField = { id: number; name: string };

interface ProductCharacteristicsFieldsProps {
    fields: CharacteristicField[];
    values: Record<number, string>;
    onChange: (characteristicId: number, value: string) => void;
    onRemove: (characteristicId: number) => void;
    canRemove: (characteristicId: number) => boolean;
    allCharacteristics: CharacteristicField[];
    activeIds: number[];
    lockedIds: Set<number>;
    onActiveIdsChange: (ids: number[]) => void;
}

export function ProductCharacteristicsFields({
    fields,
    values,
    onChange,
    onRemove,
    canRemove,
    allCharacteristics,
    activeIds,
    lockedIds,
    onActiveIdsChange,
}: ProductCharacteristicsFieldsProps) {
    if (allCharacteristics.length === 0) return null;

    return (
        <div className="space-y-3">
            <Label>Характеристики</Label>
            <CharacteristicMultiPicker
                options={allCharacteristics}
                selectedIds={activeIds}
                lockedIds={lockedIds}
                onChange={onActiveIdsChange}
                placeholder="Выберите характеристики"
            />
            {fields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Отметьте нужные характеристики или привяжите их к значениям в справочниках товаров.
                </p>
            )}
            {fields.map((field) => (
                <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor={`char-${field.id}`} className="text-muted-foreground">
                            {field.name}
                        </Label>
                        <Input
                            id={`char-${field.id}`}
                            placeholder={`Например: для «${field.name}»`}
                            value={values[field.id] ?? ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                        />
                    </div>
                    {canRemove(field.id) && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-6 h-8 w-8 shrink-0"
                            onClick={() => onRemove(field.id)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ))}
        </div>
    );
}

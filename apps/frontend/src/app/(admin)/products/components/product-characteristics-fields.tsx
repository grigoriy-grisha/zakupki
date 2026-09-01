'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CharacteristicField = { id: number; name: string };

interface ProductCharacteristicsFieldsProps {
    fields: CharacteristicField[];
    values: Record<number, string>;
    onChange: (characteristicId: number, value: string) => void;
}

export function ProductCharacteristicsFields({ fields, values, onChange }: ProductCharacteristicsFieldsProps) {
    if (fields.length === 0) return null;

    return (
        <div className="space-y-3">
            <Label>Характеристики</Label>
            {fields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={`char-${field.id}`} className="text-fg-secondary">
                        {field.name}
                    </Label>
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

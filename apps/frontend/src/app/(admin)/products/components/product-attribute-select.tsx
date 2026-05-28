'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    PRODUCT_ATTRIBUTE_KIND_LABELS,
    type ProductAttributeKind,
} from '../lib/schema';

interface ProductAttributeSelectProps {
    kind: ProductAttributeKind;
    value: number | null;
    onChange: (id: number | null) => void;
    options: { id: number; name: string }[];
}

export function ProductAttributeSelect({ kind, value, onChange, options }: ProductAttributeSelectProps) {
    const label = PRODUCT_ATTRIBUTE_KIND_LABELS[kind];

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select
                value={value ? String(value) : 'none'}
                onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
            >
                <SelectTrigger>
                    <SelectValue placeholder={`Выберите ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {options.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

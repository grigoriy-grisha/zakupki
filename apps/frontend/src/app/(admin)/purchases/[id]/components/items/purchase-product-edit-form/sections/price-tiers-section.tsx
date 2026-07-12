'use client';

import { FormSection } from '@/components/ui/form-section';
import { PriceTierEditor } from '../../../../../../products/components/package-fields';

interface PriceTiersSectionProps {
    tiers: { amount: number; unit: string; price: number }[];
    error: string | null;
    onChange: (next: { amount: number; unit: string; price: number }[]) => void;
}

export function PriceTiersSection({ tiers, error, onChange }: PriceTiersSectionProps) {
    return (
        <FormSection
            card
            title="Цены"
            description="Сколько стоит указанное количество единиц"
        >
            <PriceTierEditor
                tiers={tiers}
                addTierLabel="Добавить цену"
                onChange={onChange}
                error={error}
            />
        </FormSection>
    );
}

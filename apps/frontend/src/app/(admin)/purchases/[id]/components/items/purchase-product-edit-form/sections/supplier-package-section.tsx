'use client';

import { FormSection } from '@/components/ui/form-section';
import { PriceTierEditor } from '../../../../../../products/components/package-fields';

interface SupplierPackageSectionProps {
    supPkgTiers: { amount: number; unit: string; price: number }[];
    onChange: (next: { amount: number; unit: string; price: number }[]) => void;
}

export function SupplierPackageSection({ supPkgTiers, onChange }: SupplierPackageSectionProps) {
    return (
        <FormSection
            card
            title="Фасовка поставщика"
            description="Целая пачка от поставщика — можно заказать +1 упаковку"
        >
            <PriceTierEditor
                tiers={supPkgTiers}
                required={false}
                label=""
                addTierLabel="Добавить фасовку"
                onChange={onChange}
            />
        </FormSection>
    );
}

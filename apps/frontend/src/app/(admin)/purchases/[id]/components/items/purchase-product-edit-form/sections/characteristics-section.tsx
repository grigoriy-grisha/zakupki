'use client';

import { type CharacteristicField } from '@/components/shared/product-characteristics-fields';
import { Checkbox } from '@/components/ui/checkbox';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CharacteristicsSectionProps {
    fields: CharacteristicField[];
    values: Record<number, string>;
    showOnCard: Record<number, boolean>;
    onChange: (characteristicId: number, value: string) => void;
    onShowOnCardChange: (characteristicId: number, show: boolean) => void;
}

export function CharacteristicsSection({
    fields,
    values,
    showOnCard,
    onChange,
    onShowOnCardChange,
}: CharacteristicsSectionProps) {
    if (fields.length === 0) return null;

    return (
        <FormSection card title="Характеристики">
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                {fields.map((field) => {
                    const id = `purchase-char-${field.id}`;
                    const onCard = showOnCard[field.id] ?? false;
                    return (
                        <div key={field.id} className="min-w-0">
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <label htmlFor={id} className="truncate text-13-regular text-fg-tertiary">
                                    {field.name}
                                </label>
                                <label
                                    className={cn(
                                        'flex shrink-0 cursor-pointer items-center gap-1.5 text-11-regular transition-colors',
                                        onCard ? 'text-fg-secondary' : 'text-fg-tertiary/70 hover:text-fg-tertiary',
                                    )}
                                >
                                    <Checkbox
                                        checked={onCard}
                                        onCheckedChange={(v) => onShowOnCardChange(field.id, v === true)}
                                        aria-label={`Показывать «${field.name}» на карточке магазина`}
                                    />
                                    на карточке
                                </label>
                            </div>
                            <Input
                                id={id}
                                className="h-9 rounded-xl text-13-medium"
                                value={values[field.id] ?? ''}
                                onChange={(e) => onChange(field.id, e.target.value)}
                            />
                        </div>
                    );
                })}
            </div>
            <p className="text-12-regular text-fg-tertiary">
                Общие для товара во всех закупках. Отмеченные «на карточке» показываются в магазине под названием.
            </p>
        </FormSection>
    );
}

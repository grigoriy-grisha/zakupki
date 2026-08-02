'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { syncCharacteristicOrder } from '@/app/(admin)/products/lib/product-form-utils';

export type CharacteristicOption = { id: number; name: string };

interface CharacteristicMultiPickerProps {
    options: CharacteristicOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    /** Нельзя снять галочку (например, привязано к значению справочника). */
    lockedIds?: Set<number>;
    placeholder?: string;
    triggerClassName?: string;
    emptyMessage?: string;
}

export function CharacteristicMultiPicker({
    options,
    selectedIds,
    onChange,
    lockedIds,
    placeholder = 'Выберите характеристики',
    triggerClassName,
    emptyMessage = 'Нет характеристик',
}: CharacteristicMultiPickerProps) {
    const [open, setOpen] = useState(false);
    const selected = new Set(selectedIds);

    const label =
        selectedIds.length === 0
            ? placeholder
            : selectedIds
                  .map((id) => options.find((o) => o.id === id)?.name)
                  .filter((name): name is string => Boolean(name))
                  .join(', ');

    function toggle(id: number, checked: boolean) {
        if (lockedIds?.has(id) && !checked) return;
        const next = new Set(selectedIds);
        if (checked) next.add(id);
        else next.delete(id);
        onChange(syncCharacteristicOrder(selectedIds, [...next]));
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        'h-auto min-h-9 w-full justify-between whitespace-normal text-left font-normal',
                        triggerClassName,
                    )}
                >
                    <span className={cn(selectedIds.length === 0 && 'text-muted-foreground')}>{label}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                {options.length === 0 ? (
                    <p className="px-2 py-3 text-center text-sm text-muted-foreground">{emptyMessage}</p>
                ) : (
                    <div className="max-h-60 space-y-0.5 overflow-y-auto">
                        {options.map((opt) => {
                            const isChecked = selected.has(opt.id);
                            const isLocked = lockedIds?.has(opt.id);
                            return (
                                <label
                                    key={opt.id}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
                                        isLocked && 'cursor-default',
                                    )}
                                >
                                    <Checkbox
                                        checked={isChecked}
                                        disabled={isLocked && isChecked}
                                        onCheckedChange={(v) => toggle(opt.id, v === true)}
                                    />
                                    <span className="flex-1 text-sm">{opt.name}</span>
                                    {isLocked && isChecked && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                                </label>
                            );
                        })}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

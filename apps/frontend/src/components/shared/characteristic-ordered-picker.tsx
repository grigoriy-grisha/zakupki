'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    CharacteristicMultiPicker,
    type CharacteristicOption,
} from '@/components/shared/characteristic-multi-picker';
import { moveCharacteristicOrder, syncCharacteristicOrder } from '@/app/(admin)/products/lib/product-form-utils';

interface CharacteristicOrderedPickerProps {
    options: CharacteristicOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    lockedIds?: Set<number>;
    placeholder?: string;
    triggerClassName?: string;
    emptyMessage?: string;
}

export function CharacteristicOrderedPicker({
    options,
    selectedIds,
    onChange,
    lockedIds,
    placeholder,
    triggerClassName,
    emptyMessage,
}: CharacteristicOrderedPickerProps) {
    const names = new Map(options.map((o) => [o.id, o.name]));

    function handleIdsChange(ids: number[]) {
        onChange(syncCharacteristicOrder(selectedIds, ids));
    }

    function move(id: number, direction: 'up' | 'down') {
        onChange(moveCharacteristicOrder(selectedIds, id, direction));
    }

    return (
        <div className="flex min-w-0 w-full flex-col gap-1">
            <CharacteristicMultiPicker
                options={options}
                selectedIds={selectedIds}
                lockedIds={lockedIds}
                onChange={handleIdsChange}
                placeholder={placeholder}
                triggerClassName={triggerClassName}
                emptyMessage={emptyMessage}
            />
            {selectedIds.length > 1 && (
                <ul className="space-y-0.5 rounded-md border border-border/60 bg-muted/30 px-1 py-1">
                    {selectedIds.map((id, index) => (
                        <li
                            key={id}
                            className="grid grid-cols-[1.25rem_minmax(0,1fr)_1.5rem_1.5rem] items-center gap-x-0.5 text-xs"
                        >
                            <span className="text-center text-muted-foreground">{index + 1}.</span>
                            <span className="truncate" title={names.get(id)}>
                                {names.get(id) ?? `#${id}`}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={index === 0}
                                title="Выше"
                                onClick={() => move(id, 'up')}
                            >
                                <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={index === selectedIds.length - 1}
                                title="Ниже"
                                onClick={() => move(id, 'down')}
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

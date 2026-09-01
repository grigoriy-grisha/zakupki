'use client';

import { MoreVertical, Pencil, Plus, Tag, Trash2 } from 'lucide-react';

import { CharacteristicOrderedPicker } from '@/components/shared/characteristic-ordered-picker';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { useUpdateProductAttribute } from '../hooks';
import { AttributeFormDialog } from './attribute-form-dialog';
import type { AttributeType } from './attribute-type-card';

export type AttributeValueRowData = {
    id: number;
    name: string;
    isBrand?: boolean;
    showInTitle?: boolean;
    parentId?: number | null;
    characteristics?: { position?: number; characteristic: { id: number; name: string } }[];
};

export function getOrderedCharacteristicIds(links: AttributeValueRowData['characteristics']): number[] {
    return [...(links ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.characteristic.id - b.characteristic.id)
        .map((l) => l.characteristic.id);
}

export function ValueRow({
    item,
    type,
    characteristics,
    onDelete,
    updateValue,
    nested = false,
}: {
    item: AttributeValueRowData;
    type: AttributeType;
    characteristics: { id: number; name: string }[];
    onDelete: () => void;
    updateValue: ReturnType<typeof useUpdateProductAttribute>;
    nested?: boolean;
}) {
    return (
        <div
            className={`group/v grid grid-cols-[1.5rem_14rem_minmax(0,1fr)_auto] items-start gap-x-2 rounded-md py-1 pr-1 hover:bg-bg-soft/60 ${nested ? 'ml-3' : ''}`}
        >
            <span className="flex w-6 justify-center pt-1.5 text-fg-secondary">•</span>
            <span className="truncate px-1 pt-1.5 text-14-semibold" title={item.name}>
                {item.name}
            </span>
            <CharacteristicOrderedPicker
                options={characteristics}
                selectedIds={getOrderedCharacteristicIds(item.characteristics)}
                onChange={(ids) => updateValue.mutate({ id: item.id, characteristicIds: ids })}
                placeholder="Характеристики"
                triggerClassName="h-8 min-h-8 w-full text-12-regular"
                emptyMessage="Создайте характеристики в настройках"
            />
            <div className="flex items-center gap-0.5 self-start pt-0.5 opacity-0 transition-opacity group-hover/v:opacity-100">
                <AttributeFormDialog
                    typeId={type.id}
                    typeName={type.name}
                    mode="edit"
                    item={item}
                    trigger={
                        <Button variant="ghost" size="icon" className="size-7" title="Изменить">
                            <Pencil className="size-4" />
                        </Button>
                    }
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-error hover:text-error"
                    title="Удалить"
                    onClick={onDelete}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
        </div>
    );
}

export function BrandRow({
    brand,
    type,
    characteristics,
    childValues,
    onDelete,
    onDeleteChild,
    updateValue,
}: {
    brand: AttributeValueRowData;
    type: AttributeType;
    characteristics: { id: number; name: string }[];
    childValues: AttributeValueRowData[];
    onDelete: () => void;
    onDeleteChild: (item: AttributeValueRowData) => void;
    updateValue: ReturnType<typeof useUpdateProductAttribute>;
}) {
    return (
        <div className="rounded-md">
            <div className="group/b flex flex-wrap items-center gap-1 py-1 pr-1 hover:bg-bg-soft/60">
                <span className="flex w-6 shrink-0 justify-center text-fg-secondary">
                    <Tag className="size-3.5" />
                </span>
                <span className="min-w-[4rem] shrink-0 px-1 text-14-semibold">{brand.name}</span>
                <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/b:opacity-100">
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        parentId={brand.id}
                        parentName={brand.name}
                        mode="create"
                        trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Добавить значение">
                                <Plus className="size-4" />
                            </Button>
                        }
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                                <MoreVertical className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem
                                checked={brand.showInTitle !== false}
                                onCheckedChange={(v) => updateValue.mutate({ id: brand.id, showInTitle: v === true })}
                            >
                                Включать в заголовок описания
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        mode="edit"
                        isBrand
                        item={brand}
                        trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Изменить">
                                <Pencil className="size-4" />
                            </Button>
                        }
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-error hover:text-error"
                        title="Удалить"
                        onClick={onDelete}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>
            {childValues.length > 0 && (
                <div className="ml-3 border-l-2 border-border-low pl-2">
                    {childValues.map((item) => (
                        <ValueRow
                            key={item.id}
                            item={item}
                            type={type}
                            characteristics={characteristics}
                            updateValue={updateValue}
                            nested
                            onDelete={() => onDeleteChild(item)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

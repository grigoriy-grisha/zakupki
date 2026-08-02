'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CharacteristicOrderedPicker } from '@/components/shared/characteristic-ordered-picker';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Trash2,
    Plus,
    FolderPlus,
    MoreVertical,
    Pencil,
    Tag,
} from 'lucide-react';
import {
    useProductAttributeList,
    useDeleteProductAttribute,
    useUpdateProductAttribute,
    useUpdateAttributeType,
    useMoveAttributeType,
    useDeleteAttributeType,
} from '../hooks';
import { AttributeFormDialog } from './attribute-form-dialog';
import { CreateTypeDialog } from './create-type-dialog';
import { useCharacteristicList } from '../../characteristics/hooks/use-characteristics';

export type AttributeType = {
    id: number;
    name: string;
    parentId: number | null;
    showInTitle: boolean;
};

type AttributeValueRowData = {
    id: number;
    name: string;
    isBrand?: boolean;
    showInTitle?: boolean;
    parentId?: number | null;
    characteristics?: { position?: number; characteristic: { id: number; name: string } }[];
};

function getOrderedCharacteristicIds(links: AttributeValueRowData['characteristics']): number[] {
    return [...(links ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.characteristic.id - b.characteristic.id)
        .map((l) => l.characteristic.id);
}

export type TypeTreeNode = { type: AttributeType; children: TypeTreeNode[] };

function ValueRow({
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
            className={`group/v grid grid-cols-[1.5rem_14rem_minmax(0,1fr)_auto] items-start gap-x-2 rounded-md py-1 pr-1 hover:bg-accent/40 ${nested ? 'ml-3' : ''}`}
        >
            <span className="flex w-6 justify-center pt-1.5 text-muted-foreground">•</span>
            <span className="truncate px-1 pt-1.5 text-sm font-medium" title={item.name}>
                {item.name}
            </span>
            <CharacteristicOrderedPicker
                options={characteristics}
                selectedIds={getOrderedCharacteristicIds(item.characteristics)}
                onChange={(ids) => updateValue.mutate({ id: item.id, characteristicIds: ids })}
                placeholder="Характеристики"
                triggerClassName="h-8 min-h-8 w-full text-xs"
                emptyMessage="Создайте характеристики в настройках"
            />
            <div className="flex items-center gap-0.5 self-start pt-0.5 opacity-0 transition-opacity group-hover/v:opacity-100">
                <AttributeFormDialog
                    typeId={type.id}
                    typeName={type.name}
                    mode="edit"
                    item={item}
                    trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Изменить">
                            <Pencil className="h-4 w-4" />
                        </Button>
                    }
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Удалить"
                    onClick={onDelete}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function BrandRow({
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
            <div className="group/b flex flex-wrap items-center gap-1 py-1 pr-1 hover:bg-accent/40">
                <span className="flex w-6 shrink-0 justify-center text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-[4rem] shrink-0 px-1 text-sm font-medium">{brand.name}</span>
                <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/b:opacity-100">
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        parentId={brand.id}
                        parentName={brand.name}
                        mode="create"
                        trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Добавить значение">
                                <Plus className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
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
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Изменить">
                                <Pencil className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Удалить"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            {childValues.length > 0 && (
                <div className="ml-3 border-l-2 border-muted pl-2">
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

export function AttributeTypeCard({
    node,
    depth,
    isFirst,
    isLast,
}: {
    node: TypeTreeNode;
    depth: number;
    isFirst: boolean;
    isLast: boolean;
}) {
    const type = node.type;
    const { data: characteristics } = useCharacteristicList();
    const { data: values } = useProductAttributeList(type.id);
    const updateType = useUpdateAttributeType();
    const moveType = useMoveAttributeType();
    const deleteType = useDeleteAttributeType();
    const deleteValue = useDeleteProductAttribute();
    const updateValue = useUpdateProductAttribute();

    const [name, setName] = useState(type.name);
    const [expanded, setExpanded] = useState(true);
    const [deleteTypeOpen, setDeleteTypeOpen] = useState(false);
    const [deleteValueTarget, setDeleteValueTarget] = useState<{
        id: number;
        name: string;
        isBrand: boolean;
    } | null>(null);

    function commitName() {
        const trimmed = name.trim();
        if (trimmed && trimmed !== type.name) {
            updateType.mutate({ id: type.id, name: trimmed });
        } else {
            setName(type.name);
        }
    }

    const { valueList, brandList, valuesByBrandId } = useMemo(() => {
        const rows = (values ?? []) as AttributeValueRowData[];
        const byBrand = new Map<number, AttributeValueRowData[]>();
        for (const row of rows) {
            if (!row.isBrand && row.parentId != null) {
                const list = byBrand.get(row.parentId) ?? [];
                list.push(row);
                byBrand.set(row.parentId, list);
            }
        }
        return {
            valueList: rows.filter((v) => !v.isBrand && v.parentId == null),
            brandList: rows.filter((v) => v.isBrand && v.parentId == null),
            valuesByBrandId: byBrand,
        };
    }, [values]);

    const charOptions = (characteristics ?? []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }));

    return (
        <div>
            <div className="group flex items-center gap-1 rounded-md py-0.5 pr-1 hover:bg-accent/40">
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded((v) => !v)}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="h-7 flex-1 border-transparent bg-transparent px-1 font-medium shadow-none hover:border-input focus-visible:border-input"
                />

                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <CreateTypeDialog
                        parentId={type.id}
                        parentName={type.name}
                        trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Добавить подтип">
                                <FolderPlus className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        mode="create"
                        trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Добавить значение">
                                <Plus className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        mode="create"
                        isBrand
                        trigger={
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Добавить бренд">
                                <Tag className="h-4 w-4" />
                            </Button>
                        }
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem
                                checked={type.showInTitle}
                                onCheckedChange={(v) => updateType.mutate({ id: type.id, showInTitle: v === true })}
                            >
                                Включать в заголовок описания
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={isFirst || moveType.isPending}
                                onClick={() => moveType.mutate({ id: type.id, direction: 'up' })}
                            >
                                <ChevronUp className="h-4 w-4" />
                                Вверх
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={isLast || moveType.isPending}
                                onClick={() => moveType.mutate({ id: type.id, direction: 'down' })}
                            >
                                <ChevronDown className="h-4 w-4" />
                                Вниз
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTypeOpen(true)}>
                                <Trash2 className="h-4 w-4" />
                                Удалить тип
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {expanded && (
                <div className="ml-3 border-l-2 border-muted pl-2">
                    {valueList.map((item) => (
                        <ValueRow
                            key={item.id}
                            item={item}
                            type={type}
                            characteristics={charOptions}
                            updateValue={updateValue}
                            onDelete={() => setDeleteValueTarget({ id: item.id, name: item.name, isBrand: false })}
                        />
                    ))}

                    {brandList.map((brand) => (
                        <BrandRow
                            key={brand.id}
                            brand={brand}
                            type={type}
                            characteristics={charOptions}
                            childValues={valuesByBrandId.get(brand.id) ?? []}
                            updateValue={updateValue}
                            onDelete={() => setDeleteValueTarget({ id: brand.id, name: brand.name, isBrand: true })}
                            onDeleteChild={(item) =>
                                setDeleteValueTarget({ id: item.id, name: item.name, isBrand: false })
                            }
                        />
                    ))}

                    {node.children.map((child, i) => (
                        <AttributeTypeCard
                            key={child.type.id}
                            node={child}
                            depth={depth + 1}
                            isFirst={i === 0}
                            isLast={i === node.children.length - 1}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteTypeOpen}
                onOpenChange={setDeleteTypeOpen}
                title="Удалить тип атрибута"
                description={
                    <>
                        Удалить тип <strong>{type.name}</strong> со всеми значениями, брендами и подтипами? Эти атрибуты
                        также пропадут у товаров.
                    </>
                }
                onConfirm={() => deleteType.mutate({ id: type.id }, { onSuccess: () => setDeleteTypeOpen(false) })}
                loading={deleteType.isPending}
            />

            <ConfirmDialog
                open={!!deleteValueTarget}
                onOpenChange={(open) => !open && setDeleteValueTarget(null)}
                title={deleteValueTarget?.isBrand ? 'Удалить бренд' : 'Удалить значение'}
                description={
                    <>
                        Удалить <strong>{deleteValueTarget?.name}</strong>?
                        {deleteValueTarget?.isBrand && ' Все значения под брендом тоже будут удалены.'}
                    </>
                }
                onConfirm={() => {
                    if (!deleteValueTarget) return;
                    deleteValue.mutate({ id: deleteValueTarget.id }, { onSuccess: () => setDeleteValueTarget(null) });
                }}
                loading={deleteValue.isPending}
            />
        </div>
    );
}

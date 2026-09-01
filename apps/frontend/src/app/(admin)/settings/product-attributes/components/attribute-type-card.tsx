'use client';

import { ChevronDown, ChevronRight, ChevronUp, FolderPlus, MoreVertical, Plus, Tag,Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

import { useCharacteristicList } from '../../characteristics/hooks/use-characteristics';
import {
    useDeleteAttributeType,
    useDeleteProductAttribute,
    useMoveAttributeType,
    useProductAttributeList,
    useUpdateAttributeType,
    useUpdateProductAttribute,
} from '../hooks';
import { AttributeFormDialog } from './attribute-form-dialog';
import { type AttributeValueRowData,BrandRow, ValueRow } from './attribute-value-rows';
import { CreateTypeDialog } from './create-type-dialog';

export type AttributeType = {
    id: number;
    name: string;
    parentId: number | null;
    showInTitle: boolean;
};

export type TypeTreeNode = { type: AttributeType; children: TypeTreeNode[] };

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
            <div className="group flex items-center gap-1 rounded-md py-0.5 pr-1 hover:bg-bg-soft/60">
                <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setExpanded((v) => !v)}>
                    <ChevronRight className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="h-7 flex-1 border-transparent bg-transparent px-1 text-14-medium shadow-none hover:border-border focus-visible:border-border"
                />

                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <CreateTypeDialog
                        parentId={type.id}
                        parentName={type.name}
                        trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Добавить подтип">
                                <FolderPlus className="size-4" />
                            </Button>
                        }
                    />
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        mode="create"
                        trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Добавить значение">
                                <Plus className="size-4" />
                            </Button>
                        }
                    />
                    <AttributeFormDialog
                        typeId={type.id}
                        typeName={type.name}
                        mode="create"
                        isBrand
                        trigger={
                            <Button variant="ghost" size="icon" className="size-7" title="Добавить бренд">
                                <Tag className="size-4" />
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
                                <ChevronUp className="size-4" />
                                Вверх
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={isLast || moveType.isPending}
                                onClick={() => moveType.mutate({ id: type.id, direction: 'down' })}
                            >
                                <ChevronDown className="size-4" />
                                Вниз
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTypeOpen(true)}>
                                <Trash2 className="size-4" />
                                Удалить тип
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {expanded && (
                <div className="ml-3 border-l-2 border-border-low pl-2">
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

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CharacteristicMultiPicker } from '@/components/shared/characteristic-multi-picker';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronUp, ChevronDown, ChevronRight, Trash2, Plus, FolderPlus, MoreVertical, Pencil } from 'lucide-react';
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
import { useCharacteristicList } from '../../characteristics/hooks';

export type AttributeType = {
    id: number;
    name: string;
    parentId: number | null;
    showInTree: boolean;
    showInTitle: boolean;
};

type AttributeValueRow = {
    id: number;
    name: string;
    characteristics?: { characteristic: { id: number; name: string } }[];
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
    const [deleteValueTarget, setDeleteValueTarget] = useState<{ id: number; name: string } | null>(null);

    function commitName() {
        const trimmed = name.trim();
        if (trimmed && trimmed !== type.name) {
            updateType.mutate({ id: type.id, name: trimmed });
        } else {
            setName(type.name);
        }
    }

    const valueList = values ?? [];

    return (
        <div>
            {/* Узел типа */}
            <div className="group flex items-center gap-1 rounded-md py-0.5 pr-1 hover:bg-accent/40">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setExpanded((v) => !v)}
                >
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem
                                checked={type.showInTree}
                                onCheckedChange={(v) => updateType.mutate({ id: type.id, showInTree: v === true })}
                            >
                                Показывать в дереве каталога
                            </DropdownMenuCheckboxItem>
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

            {/* Содержимое узла */}
            {expanded && (
                <div className="ml-3 border-l-2 border-muted pl-2">
                    {(valueList as AttributeValueRow[]).map((item) => (
                        <div
                            key={item.id}
                            className="group/v flex flex-wrap items-center gap-1 rounded-md py-1 pr-1 hover:bg-accent/40"
                        >
                            <span className="w-6 shrink-0 text-center text-muted-foreground">•</span>
                            <span className="min-w-[4rem] shrink-0 px-1 text-sm font-medium">{item.name}</span>
                            <CharacteristicMultiPicker
                                options={characteristics ?? []}
                                selectedIds={item.characteristics?.map((l) => l.characteristic.id) ?? []}
                                onChange={(ids) => updateValue.mutate({ id: item.id, characteristicIds: ids })}
                                placeholder="Характеристики"
                                triggerClassName="h-8 min-h-8 flex-1 text-xs"
                                emptyMessage="Создайте характеристики в настройках"
                            />
                            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/v:opacity-100">
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
                                    onClick={() => setDeleteValueTarget({ id: item.id, name: item.name })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
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
                        Удалить тип <strong>{type.name}</strong> со всеми значениями и подтипами? Эти атрибуты также
                        пропадут у товаров.
                    </>
                }
                onConfirm={() => deleteType.mutate({ id: type.id }, { onSuccess: () => setDeleteTypeOpen(false) })}
                loading={deleteType.isPending}
            />

            <ConfirmDialog
                open={!!deleteValueTarget}
                onOpenChange={(open) => !open && setDeleteValueTarget(null)}
                title="Удалить значение"
                description={
                    <>
                        Удалить <strong>{deleteValueTarget?.name}</strong>?
                    </>
                }
                onConfirm={() => deleteValueTarget && deleteValue.mutate({ id: deleteValueTarget.id })}
                loading={deleteValue.isPending}
            />
        </div>
    );
}

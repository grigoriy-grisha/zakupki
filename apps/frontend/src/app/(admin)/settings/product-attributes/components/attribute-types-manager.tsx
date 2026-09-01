'use client';

import { FolderPlus, Layers, MoreVertical, Plus, Tag } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';

import { useAttributeTypes } from '../hooks';
import { type AttributeType, AttributeTypeCard, type TypeTreeNode } from './attribute-type-card';
import { CreateTypeDialog } from './create-type-dialog';

function buildTypeTree(types: AttributeType[]): TypeTreeNode[] {
    const byParent = new Map<number | null, AttributeType[]>();
    for (const t of types) {
        const key = t.parentId ?? null;
        const list = byParent.get(key) ?? [];
        list.push(t);
        byParent.set(key, list);
    }
    const build = (parentId: number | null): TypeTreeNode[] =>
        (byParent.get(parentId) ?? []).map((type) => ({ type, children: build(type.id) }));
    return build(null);
}

export function AttributeTypesManager() {
    const { data: types, isLoading } = useAttributeTypes();
    const tree = useMemo(() => buildTypeTree((types ?? []) as AttributeType[]), [types]);

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-start gap-4">
                <p className="max-w-2xl text-14-regular text-fg-secondary">
                    Задайте структуру каталога одним деревом. Наведите на узел: подтип (
                    <FolderPlus className="inline size-3.5" />
                    ), значение (
                    <Plus className="inline size-3.5" />
                    ), бренд (<Tag className="inline size-3.5" />
                    ). В меню (<MoreVertical className="inline size-3.5" />) — порядок и флаги отображения.
                </p>
            </div>

            {isLoading ? (
                <p className="py-8 text-center text-fg-secondary">Загрузка...</p>
            ) : tree.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-dashed py-12 text-center">
                    <Layers className="size-8 text-fg-secondary/40" />
                    <p className="mt-3 text-14-semibold">Нет типов атрибутов</p>
                    <p className="mt-1 text-14-regular text-fg-secondary">
                        Например: Производитель → Линейка → Форма → Размер.
                    </p>
                    <CreateTypeDialog
                        trigger={
                            <Button variant="outline" size="sm" className="mt-4">
                                <Plus className="mr-2 size-4" />
                                Добавить тип
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="rounded-lg bg-bg-soft/60 p-2">
                    {tree.map((node, i) => (
                        <AttributeTypeCard
                            key={node.type.id}
                            node={node}
                            depth={0}
                            isFirst={i === 0}
                            isLast={i === tree.length - 1}
                        />
                    ))}
                    <div className="flex justify-end pt-1">
                        <CreateTypeDialog
                            trigger={
                                <Button variant="ghost" size="sm" className="h-7 text-12-regular text-fg-secondary">
                                    <Plus className="mr-1 size-3.5" />
                                    Тип
                                </Button>
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

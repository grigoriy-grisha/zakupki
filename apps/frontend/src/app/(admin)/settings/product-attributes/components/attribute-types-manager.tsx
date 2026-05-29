'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Layers, FolderPlus, MoreVertical } from 'lucide-react';
import { useAttributeTypes } from '../hooks';
import { AttributeTypeCard, type AttributeType, type TypeTreeNode } from './attribute-type-card';
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
            <div className="flex items-start justify-between gap-4">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Задайте структуру каталога одним деревом. Наведите на узел, чтобы добавить подтип (
                    <FolderPlus className="inline h-3.5 w-3.5" />) или значение (<Plus className="inline h-3.5 w-3.5" />
                    ). В меню (<MoreVertical className="inline h-3.5 w-3.5" />) — порядок, флаги отображения и удаление.
                </p>
                <CreateTypeDialog
                    trigger={
                        <Button className="shrink-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить тип
                        </Button>
                    }
                />
            </div>

            {isLoading ? (
                <p className="py-8 text-center text-muted-foreground">Загрузка...</p>
            ) : tree.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-dashed py-12 text-center">
                    <Layers className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-3 text-sm font-medium">Нет типов атрибутов</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Например: Производитель → Линейка → Форма → Размер.
                    </p>
                </div>
            ) : (
                <div className="rounded-lg border p-2">
                    {tree.map((node, i) => (
                        <AttributeTypeCard
                            key={node.type.id}
                            node={node}
                            depth={0}
                            isFirst={i === 0}
                            isLast={i === tree.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

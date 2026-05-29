'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Package, FolderOpen, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/client/trpc';
import { useProductList } from './hooks';
import { ProductCard, ProductSheet } from './components';
import { cn } from '@/lib/utils';

// Дерево каталога строится по иерархии типов атрибутов (настройки):
// тип → подтип → ..., участвуют только типы с showInTree.

type PathSegment = { typeId: number; typeName: string; name: string };

type AttributeTypeRow = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
    showInTree: boolean;
};

type AttrProduct = {
    id: number;
    attributeValues?: { attribute: { name: string; typeId: number } }[];
};

type TreeNode = {
    id: string;
    /** Подпись в дереве: название типа или значение атрибута */
    label: string;
    /** Папка уровня типа (Производитель, Линейка…) — только раскрытие, без фильтра */
    isTypeFolder: boolean;
    typeId: number;
    count: number;
    path: PathSegment[];
    children: TreeNode[];
};

function productValueForType(product: AttrProduct, typeId: number): string | null {
    const found = (product.attributeValues ?? []).find((v) => v.attribute.typeId === typeId);
    return found?.attribute.name?.trim() || null;
}

function groupProductsByTypeValue(
    type: AttributeTypeRow,
    subset: AttrProduct[],
): Map<string, AttrProduct[]> {
    const groups = new Map<string, AttrProduct[]>();
    for (const product of subset) {
        const value = productValueForType(product, type.id);
        if (!value) continue;
        const list = groups.get(value) ?? [];
        list.push(product);
        groups.set(value, list);
    }
    return groups;
}

function valueNodesForType(
    type: AttributeTypeRow,
    groups: Map<string, AttrProduct[]>,
    childTypes: AttributeTypeRow[],
    ancestors: PathSegment[],
    build: (siblingTypes: AttributeTypeRow[], subset: AttrProduct[], ancestors: PathSegment[]) => TreeNode[],
): TreeNode[] {
    const nodes: TreeNode[] = [];
    const sortedNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
    for (const name of sortedNames) {
        const groupProducts = groups.get(name)!;
        const path: PathSegment[] = [...ancestors, { typeId: type.id, typeName: type.name, name }];
        nodes.push({
            id: path.map((p) => `${p.typeId}:${p.name}`).join('/'),
            label: name,
            isTypeFolder: false,
            typeId: type.id,
            count: groupProducts.length,
            path,
            children: build(childTypes, groupProducts, path),
        });
    }
    return nodes;
}

function countNodes(nodes: TreeNode[]): number {
    return nodes.reduce((sum, n) => sum + n.count, 0);
}

/** Дерево: папка типа → значения → папка подтипа → … */
function buildAttributeTree(types: AttributeTypeRow[], products: AttrProduct[]): TreeNode[] {
    const childrenOf = (parentId: number | null) =>
        types
            .filter((t) => (t.parentId ?? null) === parentId)
            .sort((a, b) => a.position - b.position || a.id - b.id);

    function build(siblingTypes: AttributeTypeRow[], subset: AttrProduct[], ancestors: PathSegment[]): TreeNode[] {
        const nodes: TreeNode[] = [];

        for (const type of siblingTypes) {
            const childTypes = childrenOf(type.id);
            const groups = groupProductsByTypeValue(type, subset);

            // Скрыт из дерева: значения без папки типа, подтипы — отдельно.
            if (!type.showInTree) {
                nodes.push(...valueNodesForType(type, groups, childTypes, ancestors, build));
                const withoutValueHere = subset.filter((p) => !productValueForType(p, type.id));
                if (childTypes.length > 0 && withoutValueHere.length > 0) {
                    nodes.push(...build(childTypes, withoutValueHere, ancestors));
                }
                continue;
            }

            // Нет своих значений — подтипы внутри папки этого типа (напр. «Японский бисер» → «Miyuki»).
            if (groups.size === 0) {
                if (childTypes.length > 0) {
                    const childNodes = build(childTypes, subset, ancestors);
                    if (childNodes.length > 0) {
                        nodes.push({
                            id: `type:${type.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`,
                            label: type.name,
                            isTypeFolder: true,
                            typeId: type.id,
                            count: countNodes(childNodes),
                            path: ancestors,
                            children: childNodes,
                        });
                    }
                }
                continue;
            }

            const folderId = `type:${type.id}:${ancestors.map((p) => `${p.typeId}:${p.name}`).join('/')}`;
            const folderNode: TreeNode = {
                id: folderId,
                label: type.name,
                isTypeFolder: true,
                typeId: type.id,
                count: [...groups.values()].reduce((sum, list) => sum + list.length, 0),
                path: ancestors,
                children: valueNodesForType(type, groups, childTypes, ancestors, build),
            };
            folderNode.count = countNodes(folderNode.children);

            nodes.push(folderNode);
        }

        return nodes;
    }

    return build(childrenOf(null), products, []);
}

function collectExpandableIds(nodes: TreeNode[]): string[] {
    return nodes.flatMap((n) => [
        ...(n.children.length > 0 ? [n.id] : []),
        ...collectExpandableIds(n.children),
    ]);
}

function matchesPath(product: AttrProduct, path: PathSegment[]): boolean {
    const values = product.attributeValues ?? [];
    return path.every((segment) =>
        values.some((v) => v.attribute.typeId === segment.typeId && v.attribute.name?.trim() === segment.name),
    );
}

function AttributeTree({
    nodes,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    depth = 0,
}: {
    nodes: TreeNode[];
    selectedId: string | null;
    onSelect: (node: TreeNode) => void;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    depth?: number;
}) {
    return (
        <div className="space-y-0.5">
            {nodes.map((node) => {
                const hasChildren = node.children.length > 0;
                const isExpanded = expandedIds.has(node.id);
                const isSelected = !node.isTypeFolder && selectedId === node.id;
                return (
                    <div key={node.id}>
                        <button
                            type="button"
                            onClick={() => {
                                if (node.isTypeFolder) {
                                    if (hasChildren) onToggle(node.id);
                                } else {
                                    onSelect(node);
                                }
                            }}
                            className={cn(
                                'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                                isSelected && 'bg-accent font-medium',
                                node.isTypeFolder && 'text-muted-foreground',
                            )}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        >
                            {hasChildren ? (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle(node.id);
                                    }}
                                    className="cursor-pointer"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </span>
                            ) : (
                                <span className="w-3.5" />
                            )}
                            <FolderOpen
                                className={cn(
                                    'h-4 w-4 shrink-0',
                                    node.isTypeFolder ? 'text-muted-foreground/70' : 'text-muted-foreground',
                                )}
                            />
                            <span className={cn('truncate', node.isTypeFolder && 'font-medium')}>{node.label}</span>
                            <span className="ml-auto pl-2 text-xs text-muted-foreground">{node.count}</span>
                        </button>
                        {hasChildren && isExpanded && (
                            <AttributeTree
                                nodes={node.children}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                expandedIds={expandedIds}
                                onToggle={onToggle}
                                depth={depth + 1}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [selectedPath, setSelectedPath] = useState<PathSegment[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const { data: products, isLoading } = useProductList(search);
    const { data: attributeTypes } = trpc.attributeTypes.list.useQuery();

    const tree = useMemo(
        () => buildAttributeTree((attributeTypes ?? []) as AttributeTypeRow[], (products ?? []) as AttrProduct[]),
        [attributeTypes, products],
    );

    useEffect(() => {
        if (tree.length === 0) return;
        setExpandedIds(new Set(collectExpandableIds(tree)));
    }, [tree]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        if (selectedPath.length === 0) return products;
        return products.filter((p) => matchesPath(p as AttrProduct, selectedPath));
    }, [products, selectedPath]);

    function handleToggle(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleSelectNode(node: TreeNode) {
        if (node.isTypeFolder) return;
        setSelectedId(node.id);
        setSelectedPath(node.path);
        if (node.children.length > 0) {
            setExpandedIds((prev) => new Set(prev).add(node.id));
        }
    }

    function clearSelection() {
        setSelectedId(null);
        setSelectedPath([]);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50">
                        <Package className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Каталог товаров</h1>
                        <p className="text-sm text-muted-foreground">{filteredProducts.length} товаров</p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setEditId(null);
                        setSheetOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить товар
                </Button>
            </div>

            <div className="flex gap-6">
                {/* Дерево по справочникам товара */}
                <div className="w-60 shrink-0">
                    <div className="rounded-lg border bg-card p-2">
                        <button
                            onClick={clearSelection}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                                selectedId === null && 'bg-accent font-medium',
                            )}
                        >
                            <Package className="h-4 w-4 text-muted-foreground" />
                            Все товары
                            <span className="ml-auto text-xs text-muted-foreground">{products?.length ?? 0}</span>
                        </button>

                        {isLoading ? (
                            <div className="space-y-2 p-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-7" />
                                ))}
                            </div>
                        ) : tree.length === 0 ? (
                            <p className="px-2 py-3 text-xs text-muted-foreground">
                                Добавьте товарам атрибуты в карточке и включите «Показывать в дереве каталога» у
                                типов в настройках.
                            </p>
                        ) : (
                            <AttributeTree
                                nodes={tree}
                                selectedId={selectedId}
                                onSelect={handleSelectNode}
                                expandedIds={expandedIds}
                                onToggle={handleToggle}
                            />
                        )}
                    </div>
                </div>

                {/* Список товаров */}
                <div className="flex-1 space-y-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Поиск по названию или бренду..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {selectedPath.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            {selectedPath.map((segment, i) => (
                                <span key={`${segment.typeId}:${segment.name}`} className="flex items-center gap-1.5">
                                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span className={cn(i === selectedPath.length - 1 && 'font-medium')}>
                                        <span className="text-muted-foreground">{segment.typeName}:</span>{' '}
                                        {segment.name}
                                    </span>
                                </span>
                            ))}
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={clearSelection}>
                                <X className="mr-1 h-3.5 w-3.5" />
                                Сбросить
                            </Button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-64" />
                            ))}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-16">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h2 className="mt-4 text-lg font-medium">
                                    {search ? 'Ничего не найдено' : 'Нет товаров'}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {search ? 'Попробуйте другой запрос' : 'Добавьте первый товар'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredProducts.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onClick={() => {
                                        setEditId(product.id);
                                        setSheetOpen(true);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ProductSheet
                open={sheetOpen}
                onOpenChange={(open) => {
                    setSheetOpen(open);
                    if (!open) setEditId(null);
                }}
                editId={editId}
            />
        </div>
    );
}

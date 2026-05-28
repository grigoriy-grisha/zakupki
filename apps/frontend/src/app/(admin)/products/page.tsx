'use client';

import { useState } from 'react';
import { Plus, Search, Package, FolderOpen, ChevronRight, ChevronDown, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';
import { toast } from 'sonner';
import { useProductList, useCreateProduct } from './hooks';
import { ProductCard, ProductSheet } from './components';
import { cn } from '@/lib/utils';

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    createdAt: string;
    children?: CategoryNode[];
};

function CategoryTree({
    categories,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
}: {
    categories: CategoryNode[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    expandedIds: Set<number>;
    onToggle: (id: number) => void;
}) {
    return (
        <div className="space-y-0.5">
            <button
                onClick={() => onSelect(null)}
                className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                    selectedId === null && 'bg-accent font-medium',
                )}
            >
                <Package className="h-4 w-4 text-muted-foreground" />
                Все товары
            </button>
            {categories.map((cat) => (
                <CategoryNodeItem
                    key={cat.id}
                    category={cat}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    depth={0}
                />
            ))}
        </div>
    );
}

function CategoryNodeItem({
    category,
    selectedId,
    onSelect,
    expandedIds,
    onToggle,
    depth,
}: {
    category: CategoryNode;
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    expandedIds: Set<number>;
    onToggle: (id: number) => void;
    depth: number;
}) {
    const hasChildren = (category.children?.length ?? 0) > 0;
    const isExpanded = expandedIds.has(category.id);

    return (
        <div>
            <button
                onClick={() => onSelect(category.id)}
                className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors',
                    selectedId === category.id && 'bg-accent font-medium',
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {hasChildren ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(category.id);
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
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{category.name}</span>
            </button>
            {hasChildren &&
                isExpanded &&
                category.children!.map((child) => (
                    <CategoryNodeItem
                        key={child.id}
                        category={child}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        expandedIds={expandedIds}
                        onToggle={onToggle}
                        depth={depth + 1}
                    />
                ))}
        </div>
    );
}

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryParentId, setNewCategoryParentId] = useState<number | null>(null);

    const { data: products, isLoading } = useProductList(search, selectedCategoryId);
    const { data: categoryTree, refetch: refetchTree } = trpc.categories.tree.useQuery();
    const { data: allCategories } = trpc.categories.list.useQuery();

    const createCategoryMutation = trpc.categories.create.useMutation({
        onSuccess: async () => {
            await refetchTree();
            setCreateCategoryOpen(false);
            setNewCategoryName('');
            setNewCategoryParentId(null);
            toast.success('Категория создана');
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteCategoryMutation = trpc.categories.delete.useMutation({
        onSuccess: async () => {
            await refetchTree();
            if (selectedCategoryId) setSelectedCategoryId(null);
            toast.success('Категория удалена');
        },
        onError: (err) => toast.error(err.message),
    });

    function handleToggle(id: number) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
                        <p className="text-sm text-muted-foreground">{products?.length ?? 0} товаров</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setNewCategoryName('');
                            setNewCategoryParentId(selectedCategoryId);
                            setCreateCategoryOpen(true);
                        }}
                    >
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Добавить папку
                    </Button>
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
            </div>

            <div className="flex gap-6">
                {/* Category sidebar */}
                <div className="w-56 shrink-0">
                    <div className="rounded-lg border bg-card p-2">
                        {categoryTree ? (
                            <CategoryTree
                                categories={categoryTree as unknown as CategoryNode[]}
                                selectedId={selectedCategoryId}
                                onSelect={setSelectedCategoryId}
                                expandedIds={expandedIds}
                                onToggle={handleToggle}
                            />
                        ) : (
                            <div className="space-y-2 p-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-7" />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Product list */}
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

                    {isLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Skeleton key={i} className="h-64" />
                            ))}
                        </div>
                    ) : products?.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-16">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h2 className="mt-4 text-lg font-medium">
                                    {search ? 'Ничего не найдено' : 'Нет товаров'}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {search ? 'Попробуйте другой запрос' : 'Добавьте первый товар в эту категорию'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {products?.map((product) => (
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
                onOpenChange={setSheetOpen}
                editId={editId}
                defaultCategoryId={selectedCategoryId}
            />

            {/* Create category dialog */}
            <Dialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Новая папка</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Название</Label>
                            <Input
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Название папки"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Родительская папка</Label>
                            <Select
                                value={newCategoryParentId ? String(newCategoryParentId) : 'none'}
                                onValueChange={(v) => setNewCategoryParentId(v === 'none' ? null : Number(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Корень" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Корень (без родителя)</SelectItem>
                                    {allCategories?.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateCategoryOpen(false)}>
                            Отмена
                        </Button>
                        <Button
                            disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                            onClick={() =>
                                createCategoryMutation.mutate({
                                    name: newCategoryName.trim(),
                                    parentId: newCategoryParentId,
                                })
                            }
                        >
                            Создать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

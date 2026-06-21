'use client';

import { useState } from 'react';
import { Plus, Search, Package, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProductList, useProductTree } from './hooks';
import { AttributeTree, ProductCard, ProductSheet } from './components';
import { PageHeader } from '@/components/ui/page-header';

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const { data: products, isLoading } = useProductList(search);
    const {
        tree,
        selectedPath,
        selectedId,
        selectedFolderLabel,
        ancestorPath,
        expandedIds,
        filteredProducts,
        handleToggle,
        handleSelectNode,
        clearSelection,
        totalCount,
    } = useProductTree(products);

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title="Каталог товаров"
                    description={`${filteredProducts.length} товаров`}
                />
                <Button
                    className="w-full rounded-full sm:w-auto"
                    variant="brand"
                    onClick={() => {
                        setEditId(null);
                        setSheetOpen(true);
                    }}
                >
                    <Plus className="mr-2 size-4 shrink-0" />
                    <span className="sm:hidden">Добавить</span>
                    <span className="hidden sm:inline">Добавить товар</span>
                </Button>
            </div>

            <div className="flex gap-6">
                <div className="hidden w-[240px] shrink-0 md:block">
                    <div className="rounded-2xl border border-border bg-bg-card p-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            className={cn(
                                'h-auto w-full justify-start gap-2 rounded-full px-3 py-1.5 text-14-medium',
                                selectedId === null
                                    ? 'bg-bg-soft text-fg-primary hover:bg-bg-soft'
                                    : 'text-fg-secondary',
                            )}
                        >
                            <Package className="size-4" />
                            Все товары
                            <span className="ml-auto text-12-medium text-fg-tertiary">{totalCount}</span>
                        </Button>

                        {isLoading ? (
                            <div className="space-y-2 p-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-7" />
                                ))}
                            </div>
                        ) : tree.length > 0 ? (
                            <AttributeTree
                                nodes={tree}
                                selectedId={selectedId}
                                onSelect={handleSelectNode}
                                expandedIds={expandedIds}
                                onToggle={handleToggle}
                            />
                        ) : null}
                    </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
                        <Input
                            placeholder="Поиск по названию или бренду..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {selectedId != null && (
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            {ancestorPath.map((segment, i) => (
                                <span key={`${segment.typeId}:${segment.name}`} className="flex items-center gap-1.5">
                                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                    <span>
                                        <span className="text-muted-foreground">{segment.typeName}:</span>{' '}
                                        {segment.name}
                                    </span>
                                </span>
                            ))}
                            {selectedFolderLabel != null && (
                                <span className="flex items-center gap-1.5">
                                    {ancestorPath.length > 0 && (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span className="font-medium">{selectedFolderLabel}</span>
                                </span>
                            )}
                            {selectedPath.map((segment, i) => (
                                <span key={`${segment.typeId}:${segment.name}`} className="flex items-center gap-1.5">
                                    {(ancestorPath.length > 0 || i > 0) && (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span
                                        className={cn(
                                            i === selectedPath.length - 1 &&
                                                selectedFolderLabel == null &&
                                                'font-medium',
                                        )}
                                    >
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
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                            ))}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <Card rounded="2xl">
                            <CardContent className="flex flex-col items-center py-16">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-soft text-fg-secondary">
                                    <Package className="size-5" />
                                </div>
                                <h2 className="mt-4 text-18-semibold text-fg-primary">
                                    {search ? 'Ничего не найдено' : 'Нет товаров'}
                                </h2>
                                <p className="mt-1 text-14-regular text-fg-secondary">
                                    {search ? 'Попробуйте другой запрос' : 'Добавьте первый товар'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
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

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
import { PageHeader } from '../lib/page-header';

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
                    icon={Package}
                    title="Каталог товаров"
                    description={`${filteredProducts.length} товаров`}
                    iconClassName="bg-success-50"
                />
                <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                        setEditId(null);
                        setSheetOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4 shrink-0" />
                    <span className="sm:hidden">Добавить</span>
                    <span className="hidden sm:inline">Добавить товар</span>
                </Button>
            </div>

            <div className="flex gap-6">
                <div className="hidden w-60 shrink-0 md:block">
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
                            <span className="ml-auto text-xs text-muted-foreground">{totalCount}</span>
                        </button>

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
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

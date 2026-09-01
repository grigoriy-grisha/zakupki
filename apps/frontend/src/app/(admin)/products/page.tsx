'use client';

import { Package,Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

import { FilterBar, ProductCard, ProductSheet } from './components';
import { useProductList, useProductTree } from './hooks';

const GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4';

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const { data: products, isLoading } = useProductList(search);
    const {
        tree,
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
                    size="sm"
                    className="w-full sm:w-auto"
                    variant="brand"
                    onClick={() => {
                        setEditId(null);
                        setSheetOpen(true);
                    }}
                >
                    <Plus className="size-4 shrink-0" />
                    <span className="sm:hidden">Добавить</span>
                    <span className="hidden sm:inline">Добавить товар</span>
                </Button>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
                        <Input
                            placeholder="Поиск по названию или бренду..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 rounded-full border-border-low bg-transparent pl-10 text-13-regular shadow-none focus-visible:border-secondary"
                        />
                    </div>

                    <div className="flex-1">
                        <FilterBar
                            tree={tree}
                            selectedId={selectedId}
                            onSelectNode={handleSelectNode}
                            expandedIds={expandedIds}
                            onToggle={handleToggle}
                            onClear={clearSelection}
                            totalCount={totalCount}
                            filteredCount={filteredProducts.length}
                            ancestorPath={ancestorPath}
                            selectedFolderLabel={selectedFolderLabel}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className={GRID_CLASS}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <Card rounded="2xl">
                        <CardContent className="flex flex-col items-center py-16">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-card text-secondary">
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
                    <div className={GRID_CLASS}>
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

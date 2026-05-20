'use client';

import { useState } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductList } from './hooks';
import { ProductCard, ProductSheet } from './components';

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);

    const { data: products, isLoading } = useProductList(search);

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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                            {search ? 'Попробуйте другой запрос' : 'Добавьте первый товар в каталог'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

            <ProductSheet open={sheetOpen} onOpenChange={setSheetOpen} editId={editId} />
        </div>
    );
}

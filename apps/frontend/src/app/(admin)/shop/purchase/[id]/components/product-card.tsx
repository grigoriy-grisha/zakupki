'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Check } from 'lucide-react';

import type { ShopPurchaseItemProductCardProps } from '../../../../lib/types';

export function ProductCard({ item, isOrdered, isSupplement, onSelect }: ShopPurchaseItemProductCardProps) {
    const price = Number(item.priceOverride ?? item.product.pricePerUnit);
    const photo = item.product.photos?.[0];
    const shortName = item.product.unit?.shortName ?? '';
    const isSoldOut = item.availableQty !== null && item.availableQty !== undefined && Number(item.availableQty) <= 0;

    return (
        <Card
            className={`group overflow-hidden transition-all ${isSoldOut && !isOrdered ? 'opacity-60' : isOrdered ? 'ring-2 ring-primary/20' : 'hover:shadow-md'}`}
        >
            <div className="relative h-48 bg-muted">
                {photo ? (
                    <img src={`/api/photos/${photo.id}`} alt={item.product.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                )}
                {isOrdered && !isSoldOut && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                    </div>
                )}
                {isSupplement && item.availableQty !== null && item.availableQty !== undefined && (
                    <Badge className={`absolute bottom-2 left-2 ${isSoldOut ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'}`}>
                        {isSoldOut ? 'Разобрано' : `Доступно: ${Number(item.availableQty)} ${shortName}`}
                    </Badge>
                )}
            </div>

            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="font-semibold leading-tight">{item.product.name}</h3>
                        {item.product.brand && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.product.brand}</p>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <span className="text-xl font-bold text-primary">{price.toLocaleString('ru-RU')} ₽</span>
                        <span className="text-sm text-muted-foreground">/{shortName}</span>
                    </div>
                </div>

                {isSoldOut && !isOrdered ? (
                    <Button className="mt-3 w-full" variant="secondary" disabled>
                        Разобрано
                    </Button>
                ) : (
                    <Button
                        className="mt-3 w-full"
                        variant={isOrdered ? 'secondary' : 'default'}
                        onClick={() => onSelect(item.id)}
                    >
                        {isOrdered ? (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Изменить заказ
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Заказать
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface ProductCardProps {
    product: {
        id: number;
        name: string;
        brand: string | null;
        pricePerUnit: string | number;
        unit: { shortName: string } | null;
        photos: { id: number }[];
    };
    onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
    const photo = product.photos?.[0];
    const price = Number(product.pricePerUnit);

    return (
        <Card
            className="group overflow-hidden transition-all hover:shadow-md hover:border-primary/20 cursor-pointer"
            onClick={onClick}
        >
            <div className="relative h-44 bg-muted">
                {photo ? (
                    <img
                        src={`/api/photos/${photo.id}`}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                )}
                <Badge className="absolute bottom-2 right-2">
                    {product.unit?.shortName ?? ''}
                </Badge>
            </div>

            <CardContent className="p-4">
                <h3 className="font-semibold leading-tight line-clamp-1">{product.name}</h3>
                {product.brand && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{product.brand}</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                        {price.toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="text-xs text-muted-foreground">
                        за {product.unit?.shortName ?? ''}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

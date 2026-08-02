'use client';

import { Package } from 'lucide-react';
import type { CurrencyRate } from '@zakupki/types';

import { ProductCard } from './product-card';
import { EmptyState } from '@/components/ui/empty-state';
import type { AggregatedForUser } from '../../../lib/order-aggregation';

/** Минимум, что нужно карточке от PurchaseItem. */
export interface ProductGridItem {
    id: number;
    purchaseItemId?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface ProductGridProps {
    items: ProductGridItem[];
    aggregatedByItem: Map<number, AggregatedForUser>;
    purchaseId: number;
    packDiscountPercent: number;
    orgFeeDefaultPercent: number;
    currencyRates: CurrencyRate[];
    isSupplement: boolean;
    canAddPackage: boolean;
    fulfillmentStatus: string;
    /** Сообщение для пустого состояния, когда items пуст. */
    emptyTitle?: string;
    emptyDescription?: string;
}

export function ProductGrid({
    items,
    aggregatedByItem,
    purchaseId,
    packDiscountPercent,
    orgFeeDefaultPercent,
    currencyRates,
    isSupplement,
    canAddPackage,
    fulfillmentStatus,
    emptyTitle = 'Пока нет товаров',
    emptyDescription = 'Администратор ещё не добавил товары в эту закупку',
}: ProductGridProps) {
    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-bg-card">
                <EmptyState icon={Package} title={emptyTitle} description={emptyDescription} />
            </div>
        );
    }

    return (
        <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
            role="list"
            aria-label="Товары закупки"
        >
            {items.map((item, i) => {
                const key = item.purchaseItemId ?? item.id;
                const aggregated = aggregatedByItem.get(key) ?? aggregatedByItem.get(item.id);
                return (
                    <div
                        key={key}
                        role="listitem"
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${Math.min(i, 8) * 30}ms`, animationFillMode: 'backwards' }}
                    >
                        <ProductCard
                            item={item}
                            purchaseId={purchaseId}
                            packDiscountPercent={packDiscountPercent}
                            orgFeeDefaultPercent={orgFeeDefaultPercent}
                            currencyRates={currencyRates}
                            currentQuantity={aggregated?.quantity ?? 0}
                            currentPackageCount={aggregated?.packageCount ?? 0}
                            baseQuantity={aggregated?.baseQuantity ?? null}
                            isSupplement={isSupplement}
                            canAddPackage={canAddPackage}
                            fulfillmentStatus={fulfillmentStatus}
                        />
                    </div>
                );
            })}
        </div>
    );
}

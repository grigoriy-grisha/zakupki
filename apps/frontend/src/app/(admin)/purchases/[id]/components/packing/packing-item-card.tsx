'use client';

import { useMemo } from 'react';
import { isWeightUnit, normalizeUnitShortName } from '@zakupki/types';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { useLocalStorageState } from '@/lib/client/use-local-storage-state';
import { cn } from '@/lib/utils';

import { computePacks, type PackRow } from '@/lib/packing/compute-packs';
import type { PurchaseItem } from '../../lib/types';
import { PackingRow } from './packing-row';

const PACKING_KEY_PREFIX = 'zakupki:packing:';

/** Ключ localStorage для пары (purchaseId, purchaseItemId). */
function packingKey(purchaseId: number, itemId: number): string {
    return `${PACKING_KEY_PREFIX}${purchaseId}:${itemId}`;
}

interface PackingItemCardProps {
    purchaseId: number;
    item: PurchaseItem;
}

export function PackingItemCard({ purchaseId, item }: PackingItemCardProps) {
    const product = item.product;

    // isWeight: проверяем и unitCode (через unit.shortName, если есть),
    // и minPackageUnit — на случай, когда unit не заполнен, но minPackage — граммы.
    const isWeight = isWeightUnit(product.unit?.shortName) || isWeightUnit(item.minPackageUnit ?? null);
    const unitShort =
        normalizeUnitShortName(product.unit?.shortName) ?? normalizeUnitShortName(item.minPackageUnit ?? null) ?? '';

    // Размер упаковки поставщика — чтобы развернуть целые пачки в эффективное
    // количество (россыпь): 1 уп. 500 г = +500 г к весу пользователя.
    const packSize = Number(item.supplierPackageAmount ?? 0);

    // ACTIVE-строки с заказом (россыпь ИЛИ хотя бы одна упаковка).
    const activeOrders = useMemo(
        () =>
            item.orderLines
                .filter((l) => Number(l.quantity) > 0 || Number(l.packageCount ?? 0) > 0)
                .map((l) => ({
                    userId: l.userId,
                    quantity: Number(l.quantity) + Number(l.packageCount ?? 0) * packSize,
                })),
        [item.orderLines, packSize],
    );

    const packs = useMemo(() => computePacks({ isWeight, orders: activeOrders }), [isWeight, activeOrders]);

    const storageKey = packingKey(purchaseId, item.id);
    const [progress, setProgress] = useLocalStorageState<Record<string, number>>(storageKey, {});

    // Агрегация прогресса.
    const { totalNeeded, totalCollected } = useMemo(() => {
        let need = 0;
        let got = 0;
        for (const p of packs) {
            need += p.needed;
            got += Math.min(progress[String(p.size)] ?? 0, p.needed);
        }
        return { totalNeeded: need, totalCollected: got };
    }, [packs, progress]);

    const progressPct = totalNeeded > 0 ? Math.min(100, Math.round((totalCollected / totalNeeded) * 100)) : 0;

    const handleRowChange = (size: number, next: number) => {
        setProgress((prev) => {
            const cur = prev[String(size)] ?? 0;
            if (cur === next) return prev;
            const updated = { ...prev };
            if (next <= 0) {
                delete updated[String(size)];
            } else {
                updated[String(size)] = next;
            }
            return updated;
        });
    };

    return (
        <div className="rounded-2xl border border-border bg-bg-card">
            <div className="flex flex-wrap items-start gap-3 border-b border-border-soft p-3 sm:p-4">
                <ProductPhotoPreview
                    photoId={product.photos?.[0]?.id}
                    alt={product.name}
                    thumbClassName="h-12 w-12 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                    <PurchaseProductLabel
                        product={product}
                        primaryClassName="block truncate text-14-semibold text-fg-primary"
                        secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-12-regular text-fg-tertiary">
                        <span>{isWeight ? 'Весовой — режем по 50' : 'Штучный — по пользователям'}</span>
                        <span>·</span>
                        <span>
                            Участников: <span className="tabular-nums text-fg-primary">{activeOrders.length}</span>
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="text-12-regular text-fg-tertiary">
                        Собрано{' '}
                        <span className="tabular-nums text-fg-primary">
                            {totalCollected} / {totalNeeded}
                        </span>
                    </div>
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-bg-soft">
                        <div
                            className={cn(
                                'h-full rounded-full transition-[width] duration-200',
                                progressPct >= 100 ? 'bg-success' : 'bg-primary',
                            )}
                            style={{ width: `${progressPct}%` }}
                            aria-hidden
                        />
                    </div>
                </div>
            </div>

            {packs.length === 0 ? (
                <div className="px-3 py-6 text-center text-13-regular text-fg-tertiary sm:py-8">
                    Заказов нет — фасовка не требуется
                </div>
            ) : (
                <div>
                    {packs.map((p: PackRow) => (
                        <PackingRow
                            key={p.size}
                            size={p.size}
                            needed={p.needed}
                            unitShortName={unitShort}
                            collected={progress[String(p.size)] ?? 0}
                            onChange={(next) => handleRowChange(p.size, next)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { EyeOff } from 'lucide-react';

import { Highlight } from '@/components/shared/highlight';
import { PackageUnitSelect } from '@/components/shared/package-unit-select';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

import type { PurchaseItem } from '../../lib/types';
import { TruncatedText } from '../truncated-text';
import { InlineCell } from './inline-cell';

export function numOrDash(value: string | number | null | undefined): string {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}

export function ProductCell({
    item,
    searchQuery,
}: {
    item: Pick<PurchaseItem, 'product' | 'supplier' | 'hidden'>;
    searchQuery: string;
}) {
    return (
        <TableCell className="sticky left-0 z-10 overflow-hidden bg-bg-soft group-hover:bg-bg-card">
            <div className={cn('flex items-center gap-2', item.hidden && 'opacity-50')}>
                <ProductPhotoPreview
                    photoId={item.product.photos?.[0]?.id}
                    photoIds={item.product.photos?.map((p) => p.id)}
                    alt={item.product.name}
                    thumbClassName="size-7 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <TruncatedText fullText={item.product.name ?? ''} className="text-13-medium text-fg-primary">
                            <Highlight text={item.product.name ?? ''} query={searchQuery} />
                        </TruncatedText>
                        {item.hidden && <EyeOff className="size-3 shrink-0 text-fg-tertiary" />}
                    </div>
                    {item.supplier && (
                        <TruncatedText fullText={item.supplier.name} className="text-11-regular text-fg-tertiary">
                            {item.supplier.name}
                        </TruncatedText>
                    )}
                </div>
            </div>
        </TableCell>
    );
}

export function PackSizeCell({
    packAmount,
    packUnit,
    fallbackUnit,
    onCommit,
}: {
    packAmount: string | number | null | undefined;
    packUnit: string | null | undefined;
    fallbackUnit: string | null | undefined;
    onCommit: (patch: { packAmount?: number | null; packUnit?: string | null }) => void;
}) {
    return (
        <TableCell className="px-2 py-1 text-right">
            <div className="flex items-center justify-end gap-1">
                <InlineCell
                    value={packAmount}
                    onCommit={(v) => onCommit({ packAmount: v })}
                    onClear={() => onCommit({ packAmount: 0 })}
                    min={0}
                    ariaLabel="Вес упаковки"
                    align="right"
                    className="w-14"
                />
                <PackageUnitSelect
                    value={packUnit ?? fallbackUnit ?? 'гр'}
                    onChange={(v) => onCommit({ packUnit: v })}
                    className="h-7"
                />
            </div>
        </TableCell>
    );
}

export function PriceCurrencyCell({
    pricePerPackCurrency,
    currencyId,
    currencyName,
    onCommit,
}: {
    pricePerPackCurrency: string | number | null | undefined;
    currencyId: number | null | undefined;
    currencyName: string | null | undefined;
    onCommit: (patch: { pricePerPackCurrency?: number | null; currencyId?: number | null }) => void;
}) {
    const { data: allCurrencies } = trpc.currencies.list.useQuery();
    const currencies = allCurrencies ?? [];

    return (
        <TableCell className="px-2 py-1 text-right">
            <div className="flex items-center justify-end gap-1">
                <InlineCell
                    value={pricePerPackCurrency == null ? null : Number(pricePerPackCurrency)}
                    onCommit={(v) => onCommit({ pricePerPackCurrency: v })}
                    onClear={() => onCommit({ pricePerPackCurrency: 0 })}
                    min={0}
                    ariaLabel="Цена за упаковку в валюте"
                    align="right"
                    className="w-16 shrink-0"
                />
                <Select
                    value={currencyId != null ? String(currencyId) : 'none'}
                    onValueChange={(v) => {
                        if (v === 'none') {
                            onCommit({ currencyId: null });
                        } else {
                            onCommit({ currencyId: Number(v) });
                        }
                    }}
                >
                    <SelectTrigger
                        size="sm"
                        aria-label="Валюта цены"
                        className="h-7 w-[76px] shrink-0 rounded-md border-border bg-bg-card px-1.5 text-11-medium text-fg-primary shadow-xs hover:border-ring"
                    >
                        <span className="truncate">{currencyName ?? '—'}</span>
                    </SelectTrigger>
                    <SelectContent align="end" position="popper" className="min-w-[8rem]">
                        <SelectItem value="none">—</SelectItem>
                        {currencies.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </TableCell>
    );
}

type QtyField = 'orderedQty' | 'assembledQty' | 'reorderedQty';

export function QtyCell({
    value,
    field,
    ariaLabel,
    onCommit,
}: {
    value: string | number | null | undefined;
    field: QtyField;
    ariaLabel: string;
    onCommit: (patch: { [K in QtyField]?: number | null }) => void;
}) {
    return (
        <TableCell className="px-2 py-1 text-right">
            <InlineCell
                value={value ?? 0}
                onCommit={(v) => onCommit({ [field]: v })}
                onClear={() => onCommit({ [field]: null })}
                allowNegative
                ariaLabel={ariaLabel}
                align="right"
                className="w-full"
            />
        </TableCell>
    );
}

export function RemainderCell({ remainderQty }: { remainderQty: number | null }) {
    return (
        <TableCell className="px-3 text-right">
            {remainderQty == null ? (
                <span className="text-14-medium text-fg-tertiary">—</span>
            ) : (
                <span
                    className={
                        remainderQty > 0
                            ? 'text-14-medium tabular-nums text-warning'
                            : remainderQty < 0
                              ? 'text-14-medium tabular-nums text-error'
                              : 'text-14-medium tabular-nums text-fg-tertiary'
                    }
                >
                    {numOrDash(remainderQty)}
                </span>
            )}
        </TableCell>
    );
}

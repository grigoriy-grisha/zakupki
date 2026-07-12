'use client';

import { MoreHorizontal, Send, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import type { ProductLabelSource } from '../../../../products/lib';
import { formatPrice510Cell, getProductPriceTiers } from '../../lib/purchase-item-prices';
import { formatRubPrice } from '../../lib/price-format';
import { formatOrderStatValue, getPurchaseItemOrderStats } from '../../lib/purchase-item-order-stats';
import type { PurchaseItem } from '../../lib/types';

export interface ItemsTableRowDerived {
    shortName: string;
    published: boolean;
    price1: number | null;
    pricePack: number | null;
    pricePackDisc: number | null;
    freeRemainder: number | null;
    isDone: boolean;
    isActive: boolean;
    /** Показывать колонку «Остаток» (фаза добора или есть позиции с supplier-pack). */
    showRemainder: boolean;
}

interface ItemsTableRowProps {
    item: PurchaseItem;
    derived: ItemsTableRowDerived;
    packDiscountPercent: number;
    selected: boolean;
    onToggleSelect: (id: number, v: boolean) => void;
    onEdit: (id: number) => void;
    onPublish: (id: number) => void;
    onDelete: (target: { id: number; product: ProductLabelSource; orderCount: number; published: boolean }) => void;
}

export function ItemsTableRow({
    item,
    derived,
    packDiscountPercent,
    selected,
    onToggleSelect,
    onEdit,
    onPublish,
    onDelete,
}: ItemsTableRowProps) {
    const {
        shortName,
        published,
        price1,
        pricePack,
        pricePackDisc,
        freeRemainder,
        isDone,
        isActive,
        showRemainder,
    } = derived;
    const stats = getPurchaseItemOrderStats(item);
    const tiers = getProductPriceTiers(item.priceTiers);
    const isManualLimit = item.targetRemainder != null && Number(item.targetRemainder) > 0;

    return (
        <TableRow
            className="group cursor-pointer hover:bg-bg-soft"
            onClick={() => onEdit(item.id)}
            data-published={published || undefined}
        >
            {/* Фото + Название (sticky left) */}
            <TableCell className="sticky left-0 z-10 bg-bg-card group-hover:bg-bg-soft transition-colors">
                <div className="flex items-center gap-3">
                    <ProductPhotoPreview
                        photoId={item.product.photos?.[0]?.id}
                        alt={item.product.name}
                        thumbClassName="h-9 w-9 rounded-md"
                    />
                    <div className="min-w-0">
                        <PurchaseProductLabel
                            product={item.product}
                            primaryClassName="block truncate text-14-semibold text-fg-primary"
                            secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                        />
                        {item.supplier && (
                            <p className="block truncate text-12-regular text-fg-tertiary" title={item.supplier.name}>
                                {item.supplier.name}
                            </p>
                        )}
                    </div>
                </div>
            </TableCell>

            {/* Фасовка */}
            <TableCell className="hidden text-12-regular text-fg-tertiary lg:table-cell">
                {item.minPackageAmount != null && item.minPackageUnit
                    ? `${Number(item.minPackageAmount)} ${item.minPackageUnit}`
                    : '—'}
            </TableCell>

            {/* Цена (с tooltip по ховеру) */}
            <TableCell className="text-right">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span tabIndex={0} className="text-14-semibold tabular-nums text-fg-primary">
                            {formatRubPrice(price1)}
                            {price1 != null && (
                                <span className="ml-1 text-12-regular text-fg-tertiary">
                                    /{shortName || 'ед'}
                                </span>
                            )}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-left">
                        <div className="space-y-1">
                            <div>
                                <span className="text-fg-tertiary">5/10 гр: </span>
                                {formatPrice510Cell(tiers)}
                            </div>
                            <div>
                                <span className="text-fg-tertiary">Пачка: </span>
                                {formatRubPrice(pricePack)}
                            </div>
                            <div>
                                <span className="text-fg-tertiary">
                                    Со скидкой {packDiscountPercent}%:{' '}
                                </span>
                                {formatRubPrice(pricePackDisc)}
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TableCell>

            {/* TG-чекбокс */}
            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                {published ? (
                    <Checkbox checked disabled aria-label="Опубликовано в Telegram" />
                ) : (
                    <Checkbox
                        checked={selected}
                        disabled={isDone}
                        aria-label="Выбрать для публикации в Telegram"
                        onCheckedChange={(v) => {
                            if (typeof v === 'boolean') onToggleSelect(item.id, v);
                        }}
                    />
                )}
            </TableCell>

            {/* Остаток (фаза добора или позиции с supplier-pack) */}
            {showRemainder && (
                <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-12-regular text-fg-tertiary">
                            В пачке:{' '}
                            {stats.packSize != null ? `${stats.packSize} ${shortName}` : '—'}
                        </span>
                        {freeRemainder == null ? (
                            <span className="text-13-medium text-fg-tertiary">—</span>
                        ) : freeRemainder > 0 ? (
                            <span className="text-14-semibold tabular-nums text-fg-primary">
                                {formatOrderStatValue(freeRemainder)} {shortName}
                                {isManualLimit && (
                                    <span className="ml-1 text-10-medium text-fg-tertiary">вручную</span>
                                )}
                            </span>
                        ) : (
                            <span className="text-13-medium text-fg-tertiary">разобрано</span>
                        )}
                    </div>
                </TableCell>
            )}

            {/* Действия (sticky right) */}
            <TableCell
                className="sticky right-0 z-10 bg-bg-card group-hover:bg-bg-soft transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Действия"
                            className="size-8 rounded-full text-fg-secondary opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem onClick={() => onEdit(item.id)}>
                            Редактировать
                        </DropdownMenuItem>
                        {!published && isActive && (
                            <DropdownMenuItem onClick={() => onPublish(item.id)}>
                                <Send className="size-3.5" /> Опубликовать в TG
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() =>
                                onDelete({
                                    id: item.id,
                                    product: item.product,
                                    orderCount: item.orderLines.length,
                                    published,
                                })
                            }
                            className="text-error focus:text-error"
                        >
                            <Trash2 className="size-3.5" /> Удалить
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

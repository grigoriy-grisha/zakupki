'use client';

import {
    isPieceUnit,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from '@zakupki/types';

import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProductLabelSource } from '@/lib/product-label';

import { formatRub, formatUnitRub, getRateToRub } from '../../lib/items-table-pricing';
import type { PurchaseCurrencyRateRef, PurchaseItem } from '../../lib/types';
import { CommentCell } from './comment-cell';
import { InlineCell } from './inline-cell';
import { numOrDash, PackSizeCell, PriceCurrencyCell, ProductCell, QtyCell, RemainderCell } from './items-table-cells';
import { RowActionsCell } from './row-actions-menu';

export interface ItemsTableRowDerived {
    shortName: string;
    published: boolean;
    packPriceRub: number | null;
    packPriceWithOrgFeeRub: number | null;
    unitPriceRub: number | null;
    unitPriceWithDeliveryRub: number | null;
    packPriceWithDeliveryRub: number | null;
    deliveryPercent: number;
    collectedQty: number;
    remainderQty: number | null;
    orgFeePercent: number;
    isDone: boolean;
    isActive: boolean;
}

type ItemPatch = Partial<{
    packAmount: number | null;
    packUnit: string | null;
    currencyId: number | null;
    pricePerPackCurrency: number | null;
    orderedQty: number | null;
    assembledQty: number | null;
    reorderedQty: number | null;
    adminComment: string | null;
    hidden: boolean;
}>;

interface ItemsTableRowProps {
    item: PurchaseItem;
    derived: ItemsTableRowDerived;
    currencyRates: PurchaseCurrencyRateRef[];
    selected: boolean;
    searchQuery?: string;
    onToggleSelect: (id: number, v: boolean) => void;
    onEdit: (id: number) => void;
    onPublish: (id: number) => void;
    onDelete: (target: { id: number; product: ProductLabelSource; orderCount: number; published: boolean }) => void;
    onCommit: (patch: ItemPatch) => void;
    onDeletePost?: (itemId: number) => void;
    onRegenerate?: (target: { itemId: number }) => void;
}

export function ItemsTableRow({
    item,
    derived,
    currencyRates,
    selected,
    searchQuery = '',
    onToggleSelect,
    onEdit,
    onPublish,
    onDelete,
    onCommit,
    onDeletePost,
    onRegenerate,
}: ItemsTableRowProps) {
    const {
        shortName,
        published,
        packPriceRub,
        packPriceWithOrgFeeRub,
        unitPriceRub,
        packPriceWithDeliveryRub,
        deliveryPercent,
        collectedQty,
        remainderQty,
        orgFeePercent,
        isDone,
        isActive,
    } = derived;

    const unit = item.packUnit ?? item.minPackageUnit ?? shortName;

    const rateToRub = getRateToRub(item, currencyRates);
    const rubEditable = rateToRub != null && rateToRub > 0;
    const packSizeRaw = item.packAmount == null ? null : Number(item.packAmount);
    const packSize = packSizeRaw != null && Number.isFinite(packSizeRaw) ? packSizeRaw : null;
    const unitEditable = rubEditable && packSize != null && packSize > 0;
    const isPiece = isPieceUnit(item.unitCode ?? item.product.unitCode);

    function commitRubPrice(solved: number | null) {
        if (solved != null) onCommit({ pricePerPackCurrency: solved });
    }

    return (
        <TableRow
            className="group hover:bg-bg-card"
            data-published={published || undefined}
            data-hidden={item.hidden || undefined}
        >
            <ProductCell item={item} searchQuery={searchQuery} />

            <PackSizeCell
                packAmount={item.packAmount}
                packUnit={item.packUnit}
                fallbackUnit={unit}
                unitCode={item.unitCode ?? item.product.unitCode}
                onCommit={onCommit}
            />

            <PriceCurrencyCell
                pricePerPackCurrency={item.pricePerPackCurrency}
                currencyId={item.currencyId}
                currencyName={item.currency?.name}
                onCommit={onCommit}
            />

            <TableCell className="px-2 py-1 text-right">
                <InlineCell
                    value={packPriceRub}
                    disabled={!rubEditable}
                    onCommit={(v) => commitRubPrice(solvePricePerPackFromPackRub(v, rateToRub))}
                    min={0}
                    ariaLabel="Цена за упаковку в рублях"
                    align="right"
                    placeholder="—"
                    format={formatRub}
                    className="w-full"
                />
            </TableCell>

            <TableCell className="px-2 py-1 text-right">
                <div className="flex items-center justify-end gap-1">
                    <InlineCell
                        value={packPriceWithOrgFeeRub}
                        disabled={!rubEditable}
                        onCommit={(v) => commitRubPrice(solvePricePerPackFromPackOrgRub(v, rateToRub, orgFeePercent))}
                        min={0}
                        ariaLabel="Цена за упаковку с оргсбором в рублях"
                        align="right"
                        placeholder="—"
                        format={formatRub}
                        className="w-full"
                    />
                    <span className="w-10 shrink-0 text-13-regular text-fg-tertiary">+{orgFeePercent}%</span>
                </div>
            </TableCell>

            <TableCell className="px-2 py-1 text-right">
                <div className="flex items-center justify-end gap-1">
                    <InlineCell
                        value={packPriceWithDeliveryRub}
                        disabled={!rubEditable}
                        onCommit={(v) =>
                            commitRubPrice(
                                solvePricePerPackFromPackOrgRub(v, rateToRub, orgFeePercent, deliveryPercent),
                            )
                        }
                        min={0}
                        ariaLabel="Цена за упаковку с доставкой в рублях"
                        align="right"
                        placeholder="—"
                        format={formatRub}
                        className="w-full"
                    />
                    <span className="w-10 shrink-0 text-13-regular text-fg-tertiary">+{deliveryPercent}%</span>
                </div>
            </TableCell>

            {isPiece ? (
                <TableCell className="px-2 py-1 text-right">
                    <span className="text-13-regular text-fg-tertiary">—</span>
                </TableCell>
            ) : (
                <TableCell className="px-2 py-1 text-right">
                    <div className="flex items-center justify-end gap-1">
                        <InlineCell
                            value={unitPriceRub}
                            disabled={!unitEditable}
                            onCommit={(v) =>
                                commitRubPrice(solvePricePerPackFromUnitRub(v, rateToRub, orgFeePercent, packSize))
                            }
                            min={0}
                            ariaLabel="Цена за 1 единицу в рублях"
                            align="right"
                            placeholder="—"
                            format={formatUnitRub}
                            className="w-full"
                        />
                        <span className="w-10 shrink-0 text-13-regular text-fg-tertiary">/{unit || 'ед'}</span>
                    </div>
                </TableCell>
            )}

            <TableCell className="px-3 text-right text-14-medium tabular-nums text-fg-secondary">
                {numOrDash(collectedQty)}
                <span className="ml-1 text-13-regular text-fg-tertiary">{unit || 'ед'}</span>
            </TableCell>

            <QtyCell value={item.orderedQty} field="orderedQty" ariaLabel="Заказано" onCommit={onCommit} />
            <QtyCell value={item.assembledQty} field="assembledQty" ariaLabel="Скомплектовано" onCommit={onCommit} />
            <QtyCell value={item.reorderedQty} field="reorderedQty" ariaLabel="Дозаказано" onCommit={onCommit} />

            <RemainderCell remainderQty={remainderQty} />

            <TableCell className="px-3 py-1">
                <CommentCell
                    value={item.adminComment}
                    query={searchQuery}
                    onCommit={(v) => onCommit({ adminComment: v })}
                />
            </TableCell>

            <TableCell className="px-2 text-center">
                {published ? (
                    <Checkbox checked disabled aria-label="Опубликовано в Telegram" />
                ) : (
                    <Checkbox
                        checked={selected}
                        disabled={isDone || item.hidden}
                        aria-label="Выбрать для публикации в Telegram"
                        onCheckedChange={(v) => {
                            if (typeof v === 'boolean') onToggleSelect(item.id, v);
                        }}
                    />
                )}
            </TableCell>

            <RowActionsCell
                itemId={item.id}
                product={item.product}
                hidden={item.hidden}
                published={published}
                isActive={isActive}
                orderCount={item.orderLines.filter((l) => l.status !== 'CANCELLED').length}
                onEdit={onEdit}
                onPublish={onPublish}
                onDelete={onDelete}
                onCommitHidden={(hidden) => onCommit({ hidden })}
                onDeletePost={onDeletePost}
                onRegenerate={onRegenerate}
            />
        </TableRow>
    );
}

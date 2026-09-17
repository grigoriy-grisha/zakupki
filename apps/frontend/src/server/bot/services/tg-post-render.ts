import type { Prisma } from '@zakupki/database';
import {
    computeRawPool,
    computeUnitPriceRubNewModel,
    getStageStrategy,
    getUnitByCode,
    mapToPurchaseItem,
    type PurchaseFulfillmentStatus,
    toOrderLinesVO,
} from '@zakupki/types';

import { formatPurchaseProductLine1 } from '@/lib/product-label/format-purchase';

import type { ChannelPostPhoto } from '../domain/types';
import type { TgClient } from '../lib/tg-client';
import type { BotProductRenderer } from './bot/bot-product-renderer.service';

export const ITEM_INCLUDE = {
    product: {
        select: {
            id: true,
            name: true,
            articleNumber: true,
            unitCode: true,
            photos: {
                orderBy: { sortOrder: 'asc' as const },
                take: 1,
                select: { id: true, objectKey: true, mimeType: true },
            },
        },
    },
    supplier: { select: { id: true, name: true } },
    orderLines: { where: { status: 'ACTIVE' as const } },
    purchase: {
        select: {
            fulfillmentStatus: true,
            deliveryPercent: true,
            currencyRates: { select: { currencyId: true, rateToRub: true } },
        },
    },
} satisfies Prisma.PurchaseItemInclude;

type Item = Prisma.PurchaseItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

/** Загружает фото для редактирования поста. `null` если фото не было. */
export async function loadPostPhoto(tg: TgClient, item: Item): Promise<ChannelPostPhoto | null> {
    const first = item.product.photos[0];
    return first ? tg.loadPhoto(first) : null;
}

export async function tryEditItemPost(tg: TgClient, renderer: BotProductRenderer, item: Item): Promise<void> {
    if (!item.tgMessageId || !item.tgChannelId) return;
    const photo = await loadPostPhoto(tg, item);
    await tg.editPost(
        item.tgChannelId,
        Number(item.tgMessageId),
        joinPostText(renderer, item, sumOrderLines(item), computeItemUnitPriceRub(item)),
        photo,
    );
}

export function buildPostHeader(renderer: BotProductRenderer, item: Item, unitPriceRub: number | null): string {
    return renderer.buildPostHeader({
        name: formatPurchaseProductLine1({
            name: item.product.name,
            articleNumber: item.product.articleNumber,
        }),
        description: item.description ?? null,
        unitPriceRub,
        minPackageAmount: item.minPackageAmount,
        minPackageUnit: item.minPackageUnit,
        unitCode: item.unitCode,
    });
}

function buildStatusBlock(renderer: BotProductRenderer, item: Item, orderLinesSum: number): string {
    return renderer.buildStatusLine({
        item: {
            supplierLimit: item.supplierLimit as unknown as number | null,
            supplierLimitUnit: item.supplierLimitUnit,
        },
        purchase: { fulfillmentStatus: item.purchase.fulfillmentStatus },
        orderLinesSum,
        freeToOrder: computeFreeToOrder(item),
        unit: unitShortName(item),
    });
}

/**
 * Сколько ещё свободно к заказу — минимум из пула и глобальных капов.
 * Путь 1: targetRemainder админа. Путь 2: авто по пачкам поставщика (packsNeeded*packSize − ordered).
 * Путь 3: orderedQty — остаток к продаже (для шт/туб — единственный путь, для гр — min с пачками).
 * supplierLimit (если задан) ограничивает итог сверху — как validateSupplierLimit на бэке.
 * null = ограничения нет (нет ни targetRemainder, ни orderedQty, ни packSize, ни supplierLimit).
 */
function computeFreeToOrder(item: Item): number | null {
    const stage = item.purchase.fulfillmentStatus as PurchaseFulfillmentStatus;
    const packSize = item.packAmount != null ? Number(item.packAmount) : null;
    const aggregation = getStageStrategy(stage).aggregateForPool(toOrderLinesVO(item.orderLines), packSize);
    const pool = computeRawPool({
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        packSize,
        aggregation,
        unitCode: item.unitCode ?? null,
        orderedQty: item.orderedQty != null ? Number(item.orderedQty) : null,
    });
    if (item.supplierLimit == null) return pool;
    const supplierStock = Math.max(0, Number(item.supplierLimit) - aggregation.totalOrderedWithPackages);
    return pool == null ? supplierStock : Math.min(pool, supplierStock);
}

/** Short name ед. продукта (напр. «гр») для строки «Свободно к заказу». */
function unitShortName(item: Item): string | null {
    return getUnitByCode(item.unitCode)?.shortName ?? null;
}

function joinPostText(
    renderer: BotProductRenderer,
    item: Item,
    orderLinesSum: number,
    unitPriceRub: number | null,
): string {
    const top = buildPostHeader(renderer, item, unitPriceRub);
    const bottom = buildStatusBlock(renderer, item, orderLinesSum);
    return top && bottom ? `${top}\n\n${bottom}` : top || bottom;
}

function sumOrderLines(item: Item): number {
    // effectiveQty = qty + packageCount*packSize. Пакеты = qty для целей лимита/пула,
    // иначе "Свободно к заказу" будет завышено (worker не учитывал пакеты, и лимит
    // показывал свободно больше, чем реально).
    const packSize = item.packAmount;
    return item.orderLines.reduce(
        (s, l) => s + Number(l.quantity) + Number(l.packageCount) * Number(packSize ?? 0),
        0,
    );
}

/** Вычисляет цену за единицу по новой модели (без глобального оргсбора —
 * используется override или 0). Для поста в канале этого достаточно: цена
 * с оргсбором видна в самой цене за упаковку. */
export function computeItemUnitPriceRub(item: Item): number | null {
    return computeUnitPriceRubNewModel(
        mapToPurchaseItem(item, 0, {
            orgFeeDefaultPercent: 0,
            deliveryPercent: Number(item.purchase?.deliveryPercent ?? 0),
            currencyRates: (item.purchase?.currencyRates ?? []).map((r) => ({
                currencyId: r.currencyId,
                rateToRub: Number(r.rateToRub),
            })),
        }),
    );
}

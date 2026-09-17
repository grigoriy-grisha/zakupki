import type { Prisma, PrismaClient } from '@zakupki/database';
import { dbClient } from '@zakupki/database';
import { createLogger } from '@zakupki/logger';
import type { TgPostJob } from '@zakupki/queue';
import type { TgPostJobsQueue } from '@zakupki/queue';
import { getTgPostFastJobsQueue, getTgPostJobsQueue } from '@zakupki/queue';
import {
    computeRawPool,
    computeUnitPriceRubNewModel,
    getStageStrategy,
    getUnitByCode,
    mapToPurchaseItem,
    type PurchaseFulfillmentStatus,
    toOrderLinesVO,
} from '@zakupki/types';
import type { Api } from 'grammy';

import { formatPurchaseProductLine1 } from '@/lib/product-label/format-purchase';

import type { ChannelPostPhoto } from '../domain/types';
import { getOrInitDiscussionChatId } from '../lib/channel-discussion';
import { getDiscussionMessageStore } from '../lib/discussion-message-store';
import { getOrdersChatIdFromEnv } from '../lib/telegram-chat';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import type { TgClient } from '../lib/tg-client';
import { shopUrlKeyboard } from '../lib/webapp-url';
import type { BotProductRenderer } from './bot/bot-product-renderer.service';

const log = createLogger('tg-post-worker');

const SHOP_COMMENT_FIRST_DELAY_MS = 3_000;
const SHOP_COMMENT_RETRY_DELAY_MS = 10_000;
const SHOP_COMMENT_MAX_ATTEMPTS = 3;

const ITEM_INCLUDE = {
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
async function loadPostPhoto(tg: TgClient, item: Item): Promise<ChannelPostPhoto | null> {
    const first = item.product.photos[0];
    return first ? tg.loadPhoto(first) : null;
}

async function tryEditItemPost(tg: TgClient, renderer: BotProductRenderer, item: Item): Promise<void> {
    if (!item.tgMessageId || !item.tgChannelId) return;
    const photo = await loadPostPhoto(tg, item);
    await tg.editPost(
        item.tgChannelId,
        Number(item.tgMessageId),
        joinPostText(renderer, item, sumOrderLines(item), computeItemUnitPriceRub(item)),
        photo,
    );
}

function buildPostHeader(renderer: BotProductRenderer, item: Item, unitPriceRub: number | null): string {
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

function joinPostText(renderer: BotProductRenderer, item: Item, orderLinesSum: number, unitPriceRub: number | null): string {
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
function computeItemUnitPriceRub(item: Item): number | null {
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

/**
 * Один воркер для всех операций с постами/комментариями в канале.
 * Пайплайн handler'а: загрузить данные → отрендерить → отправить через TgClient.
 * Retry/backoff — в BullMQ, idempotency — на jobId, debounce — в очереди.
 */
export class TgPostWorker {
    constructor(
        private readonly tg: TgClient,
        private readonly api: Api,
        private readonly renderer: BotProductRenderer,
        private readonly db: PrismaClient = dbClient,
    ) {}

    setupWorker(): void {
        const queue = getTgPostJobsQueue();
        const fastQueue = getTgPostFastJobsQueue();
        if (!getChannelIdFromEnv()) {
            log.warn('TG_CHANNEL_ID not set — worker disabled');
            queue.setupWorker({ handler: async () => undefined });
            fastQueue.setupWorker({ handler: async () => undefined });
            return;
        }
        const onFailed: NonNullable<Parameters<TgPostJobsQueue['setupWorker']>[0]['onFailed']> = (
            job,
            err,
            final,
        ) => {
            const attempts = job?.opts?.attempts ?? 1;
            const made = job?.attemptsMade ?? 0;
            if (final) {
                log.error(
                    { jobId: job?.id, attempts: `${made}/${attempts}`, err, data: job?.data },
                    'job FAILED (final)',
                );
            } else {
                log.warn(
                    {
                        jobId: job?.id,
                        attempts: `${made}/${attempts}`,
                        err: { name: err.name, message: err.message },
                        data: job?.data,
                    },
                    'job failed, will retry',
                );
            }
        };
        queue.setupWorker({ handler: (job) => this.process(job), onFailed });
        fastQueue.setupWorker({ handler: (job) => this.process(job), onFailed });
        log.info('Worker started (regular + fast lanes)');
    }

    private async process(job: { id?: string; data: TgPostJob }): Promise<void> {
        const ctx = { queueJobId: job.id, type: job.data.type };
        const startedAt = Date.now();
        log.debug(ctx, 'job received');
        try {
            switch (job.data.type) {
                case 'POST_CREATE':
                    await this.createPost(job.data.itemId);
                    break;
                case 'POST_DELETE':
                    await this.deletePost(job.data);
                    break;
                case 'USER_ORDERS_REJECT':
                    await this.rejectUserOrders(job.data.messageIds);
                    break;
                case 'ITEM_CHANGED':
                    await this.editItemPost(job.data.itemId);
                    break;
                case 'SHOP_COMMENT_ATTACH':
                    await this.attachShopComment(job.data);
                    break;
                case 'PURCHASE_FULFILLMENT_CHANGED':
                    await this.fanOutPurchaseItems(job.data.purchaseId, 'fulfillment', job.data.next);
                    break;
                case 'PURCHASE_STATUS_CHANGED':
                    await this.fanOutPurchaseItems(job.data.purchaseId, 'status', job.data.next);
                    break;
                case 'PURCHASE_ITEM_SYNC':
                    await this.syncPurchaseItem(job.data);
                    break;
            }
            log.info({ ...ctx, durationMs: Date.now() - startedAt }, 'job done');
        } catch (err) {
            log.error({ ...ctx, durationMs: Date.now() - startedAt, err }, 'job failed');
            throw err;
        }
    }

    // ── Посты: создание ───────────────────────────────────────

    private async createPost(itemId: number): Promise<void> {
        const item = await this.db.purchaseItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
        if (!item) {
            log.warn({ itemId }, 'createPost: item not found');
            return;
        }
        if (item.tgMessageId) {
            log.info({ itemId, messageId: item.tgMessageId }, 'createPost: already published');
            return;
        }
        if (item.hidden) {
            log.info({ itemId }, 'createPost: item is hidden, skipping publish');
            return;
        }

        const photo = await loadPostPhoto(this.tg, item);
        log.info(
            {
                itemId,
                purchaseId: item.purchaseId,
                product: item.product.name,
                photoBytes: photo?.data.length ?? 0,
            },
            'createPost: publishing',
        );
        const channelId = getChannelIdFromEnv()!;
        const { messageId } = await this.tg.sendPost(
            channelId,
            buildPostHeader(this.renderer, item, computeItemUnitPriceRub(item)),
            photo,
        );

        await this.db.purchaseItem.update({
            where: { id: itemId },
            data: { tgMessageId: String(messageId), tgChannelId: channelId, publicationState: 'PUBLISHED' },
        });
        log.info({ itemId, messageId, channelId }, 'createPost: published and saved');

        const discussionId = await getOrInitDiscussionChatId(this.api);
        if (!discussionId) {
            log.warn({ itemId, messageId }, 'no discussion chat, shop comment skipped');
            return;
        }
        await getTgPostJobsQueue().addDelayed(
            { type: 'SHOP_COMMENT_ATTACH', itemId, attempt: 0 },
            `shop-comment-${itemId}-0`,
            SHOP_COMMENT_FIRST_DELAY_MS,
        );
        log.info({ itemId, messageId }, 'createPost: shop comment scheduled');
    }

    private async attachShopComment(data: Extract<TgPostJob, { type: 'SHOP_COMMENT_ATTACH' }>): Promise<void> {
        const { itemId, attempt } = data;
        log.info({ itemId, attempt }, 'attachShopComment: checking autoforward');
        const item = await this.db.purchaseItem.findUnique({
            where: { id: itemId },
            select: { purchaseId: true, tgMessageId: true, tgChannelId: true },
        });
        if (!item?.tgMessageId || !item.tgChannelId) {
            log.warn({ itemId, attempt }, 'attachShopComment: post missing, skipping');
            return;
        }
        const discussionId = await getOrInitDiscussionChatId(this.api);
        if (!discussionId) {
            log.warn({ itemId, attempt }, 'attachShopComment: no discussion chat');
            return;
        }

        const channelId = getChannelIdFromEnv()!;
        const autoForwardId = await getDiscussionMessageStore().get(channelId, Number(item.tgMessageId));
        if (autoForwardId != null) {
            await this.tg.sendComment(
                discussionId,
                this.renderer.shopCommentText,
                autoForwardId,
                shopUrlKeyboard(item.purchaseId, itemId),
            );
            log.info({ itemId, messageId: item.tgMessageId, autoForwardId, attempt }, 'attachShopComment: attached');
            return;
        }

        if (attempt < SHOP_COMMENT_MAX_ATTEMPTS) {
            await getTgPostJobsQueue().addDelayed(
                { type: 'SHOP_COMMENT_ATTACH', itemId, attempt: attempt + 1 },
                `shop-comment-${itemId}-${attempt + 1}`,
                SHOP_COMMENT_RETRY_DELAY_MS,
            );
            log.info(
                { itemId, messageId: item.tgMessageId, attempt },
                'attachShopComment: autoforward not indexed yet, requeued',
            );
            return;
        }

        log.warn(
            { itemId, messageId: item.tgMessageId, attempt },
            'attachShopComment: autoforward not indexed in time, shop comment sent unattached',
        );
        await this.tg.sendComment(
            discussionId,
            this.renderer.shopCommentText,
            undefined,
            shopUrlKeyboard(item.purchaseId, itemId),
        );
    }

    private async deletePost(job: Extract<TgPostJob, { type: 'POST_DELETE' }>): Promise<void> {
        log.info({ itemId: job.itemId, channelId: job.channelId, messageId: job.messageId }, 'deletePost: start');
        let channelId = job.channelId ?? null;
        let messageId = job.messageId ?? null;
        if (!channelId || !messageId) {
            const item = await this.db.purchaseItem.findUnique({
                where: { id: job.itemId },
                select: { tgChannelId: true, tgMessageId: true },
            });
            channelId = item?.tgChannelId ?? null;
            messageId = item?.tgMessageId ?? null;
        }
        if (!channelId || !messageId) {
            log.warn({ itemId: job.itemId }, 'deletePost: no post to delete');
            return;
        }
        await this.tg.deletePost(channelId, Number(messageId));
        log.info({ itemId: job.itemId, messageId }, 'deletePost done');
    }

    // ── Реакции ────────────────────────────────────────────────

    private async rejectUserOrders(messageIds: string[]): Promise<void> {
        log.info({ count: messageIds.length }, 'rejectUserOrders: start');
        const ordersChatId = getOrdersChatIdFromEnv();
        if (!ordersChatId) {
            log.warn('rejectUserOrders: no orders chat configured');
            return;
        }
        if (messageIds.length === 0) {
            log.debug('rejectUserOrders: empty messageIds');
            return;
        }
        for (const idStr of messageIds) {
            const messageId = Number(idStr);
            if (!Number.isFinite(messageId)) continue;
            await this.tg.setReaction(ordersChatId, messageId, '👎');
        }
        log.info({ count: messageIds.length, ordersChatId }, 'rejectUserOrders done');
    }

    // ── Посты: редактирование ─────────────────────────────────

    private async editItemPost(itemId: number): Promise<void> {
        log.info({ itemId }, 'editItemPost: start');
        const item = await this.db.purchaseItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
        if (!item) {
            log.warn({ itemId }, 'editItemPost: item not found');
            return;
        }
        if (!item.tgMessageId) {
            log.info({ itemId }, 'editItemPost: no post yet, nothing to edit');
            return;
        }
        // Item was hidden after publishing — remove its channel post instead of editing.
        if (item.hidden) {
            log.info({ itemId, messageId: item.tgMessageId }, 'editItemPost: item hidden, deleting channel post');
            await this.tg.deletePost(item.tgChannelId!, Number(item.tgMessageId));
            // Back to DRAFT: tgMessageId/tgChannelId are nulled, and publicationState must
            // follow — otherwise it stays PUBLISHED with no post, breaking
            // findItemByTelegramPost/findItemByTgMessageId (they filter publicationState:
            // 'PUBLISHED') and the status semantics on re-publish.
            await this.db.purchaseItem.update({
                where: { id: itemId },
                data: { tgMessageId: null, tgChannelId: null, publicationState: 'DRAFT' },
            });
            return;
        }
        await tryEditItemPost(this.tg, this.renderer, item);
        log.info({ itemId, messageId: item.tgMessageId }, 'editItemPost done');
    }

    // ── Закупка: статус изменился ─────────────────────────────

    private async fanOutPurchaseItems(
        purchaseId: number,
        kind: 'fulfillment' | 'status',
        next: string,
    ): Promise<void> {
        log.info({ purchaseId, kind, next }, 'fanOutPurchaseItems: start');
        const items = await this.db.purchaseItem.findMany({
            where: { purchaseId, tgMessageId: { not: null }, hidden: false },
            select: { id: true },
        });
        const queue = getTgPostJobsQueue();
        for (const item of items) {
            await queue.addImmediate(
                { type: 'PURCHASE_ITEM_SYNC', purchaseId, itemId: item.id, kind, next },
                `purchase-sync-${purchaseId}-${item.id}-${kind}`,
            );
        }
        log.info({ purchaseId, kind, next, items: items.length }, 'fanOutPurchaseItems done');
    }

    private async syncPurchaseItem(data: Extract<TgPostJob, { type: 'PURCHASE_ITEM_SYNC' }>): Promise<void> {
        const { purchaseId, itemId, kind, next } = data;
        log.info({ purchaseId, itemId, kind, next }, 'syncPurchaseItem: start');
        const item = await this.db.purchaseItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
        if (!item) {
            log.warn({ itemId }, 'syncPurchaseItem: item not found');
            return;
        }
        if (!item.tgMessageId || item.hidden) {
            log.info({ itemId }, 'syncPurchaseItem: no post or hidden, skip');
            return;
        }

        await tryEditItemPost(this.tg, this.renderer, item);

        const discussionId = await getOrInitDiscussionChatId(this.api);
        if (!discussionId) {
            log.warn({ purchaseId, itemId, kind }, 'syncPurchaseItem: no discussion chat');
            return;
        }
        const channelId = getChannelIdFromEnv()!;
        const autoForwardId = await getDiscussionMessageStore().get(channelId, Number(item.tgMessageId));
        const commentData = { status: next, channelPostMessageId: Number(item.tgMessageId) };
        const text =
            kind === 'fulfillment'
                ? this.renderer.buildFulfillmentComment(commentData)
                : this.renderer.buildPurchaseStatusComment(commentData);
        if (!text) return;
        await this.tg.sendComment(discussionId, text, autoForwardId ?? undefined);
        log.info({ purchaseId, itemId, kind, next }, 'syncPurchaseItem done');
    }
}

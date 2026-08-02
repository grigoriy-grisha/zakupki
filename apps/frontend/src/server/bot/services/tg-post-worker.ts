import type { Prisma, PrismaClient } from '@zakupki/database';
import { dbClient } from '@zakupki/database';
import type { TgPostJob } from '@zakupki/queue';
import { getTgPostJobsQueue } from '@zakupki/queue';
import { createLogger } from '@zakupki/logger';
import type { Api } from 'grammy';

import { getOrInitDiscussionChatId } from '../lib/channel-discussion';
import { getDiscussionMessageStore } from '../lib/discussion-message-store';
import { getChannelIdFromEnv } from '../lib/telegram-post';
import { getOrdersChatIdFromEnv } from '../lib/telegram-chat';
import { TgClient } from '../lib/tg-client';
import { shopInlineKeyboardForGroup } from '../lib/webapp-url';
import type { ChannelPostPhoto } from '../domain/types';
import type { BotProductRenderer } from './bot/bot-product-renderer.service';
import {
    computeRawPool,
    computeUnitPriceRubNewModel,
    getStageStrategy,
    getUnitByCode,
    mapToPurchaseItem,
    toOrderLinesVO,
    type PurchaseFulfillmentStatus,
} from '@zakupki/types';

const log = createLogger('tg-post-worker');

const ITEM_INCLUDE = {
    product: {
        select: {
            id: true,
            name: true,
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

function buildPostHeader(renderer: BotProductRenderer, item: Item, unitPriceRub: number | null): string {
    return renderer.buildPostHeader({
        name: item.product.name,
        // После миграции Supplier описание и цены/фасовка лежат на PurchaseItem, не на Product.
        description: item.description ?? null,
        unitPriceRub,
        minPackageAmount: item.minPackageAmount,
        minPackageUnit: item.minPackageUnit,
        unitCode: item.product.unitCode,
    });
}

function buildStatusBlock(renderer: BotProductRenderer, item: Item, orderLinesSum: number): string {
    return renderer.buildStatusLine({
        item: {
            supplierLimit: item.supplierLimit as unknown as number | null,
            supplierLimitUnit: item.supplierLimitUnit,
            targetRemainder: item.targetRemainder as unknown as number | null,
        },
        purchase: { fulfillmentStatus: item.purchase.fulfillmentStatus },
        orderLinesSum,
        freeToOrder: computeFreeToOrder(item),
        unit: item.supplierLimitUnit ?? unitShortName(item),
    });
}

/**
 * Сколько ещё свободно к заказу — пул добора, посчитанный как в UI (computeRawPool).
 * Путь 1: targetRemainder админа. Путь 2: авто по пачкам поставщика (packsNeeded*packSize − ordered).
 * null = ограничения нет (нет ни targetRemainder, ни packSize).
 */
function computeFreeToOrder(item: Item): number | null {
    const stage = item.purchase.fulfillmentStatus as PurchaseFulfillmentStatus;
    const aggregation = getStageStrategy(stage).aggregateForPool(toOrderLinesVO(item.orderLines));
    return computeRawPool({
        targetRemainder: item.targetRemainder != null ? Number(item.targetRemainder) : null,
        packSize: item.packAmount != null ? Number(item.packAmount) : null,
        aggregation,
    });
}

/** Short name ед. продукта (напр. «гр») для строки «Свободно к заказу». */
function unitShortName(item: Item): string | null {
    return getUnitByCode(item.product.unitCode)?.shortName ?? null;
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
            currencyRates: (item.purchase?.currencyRates ?? []).map((r) => ({
                currencyId: r.currencyId,
                rateToRub: Number(r.rateToRub),
            })),
        }),
    );
}

async function tryEditItemPost(tg: TgClient, renderer: BotProductRenderer, item: Item): Promise<void> {
    if (!item.tgMessageId || !item.tgChannelId) return;
    const hadPhoto = item.product.photos.length > 0;
    const photo = await loadPostPhoto(tg, item);
    // Если у поста было фото, но оно не загрузилось — пропускаем, иначе Telegram кидает
    // "message can't be edited" (caption-пост нельзя отредактировать как text-only).
    if (hadPhoto && !photo) {
        log.warn({ itemId: item.id, messageId: item.tgMessageId }, 'photo missing, skipping edit');
        return;
    }
    await tg.editPost(
        item.tgChannelId,
        Number(item.tgMessageId),
        joinPostText(renderer, item, sumOrderLines(item), computeItemUnitPriceRub(item)),
        photo,
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
        if (!getChannelIdFromEnv()) {
            log.warn('TG_CHANNEL_ID not set — worker disabled');
            queue.setupWorker({ handler: async () => undefined });
            return;
        }
        queue.setupWorker({
            handler: async (job) => this.process(job),
            onFailed: (job, err, final) => {
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
            },
        });
        log.info('Worker started');
    }

    private async process(job: { id?: string; data: TgPostJob }): Promise<void> {
        const ctx = { jobId: job.id, type: job.data.type };
        log.debug(ctx, 'job received');
        try {
            switch (job.data.type) {
                case 'POST_CREATE':
                    return this.createPost(job.data.itemId);
                case 'POST_DELETE':
                    return this.deletePost(job.data.itemId);
                case 'USER_ORDERS_REJECT':
                    return this.rejectUserOrders(job.data.messageIds);
                case 'ITEM_CHANGED':
                    return this.editItemPost(job.data.itemId);
                case 'PURCHASE_FULFILLMENT_CHANGED':
                    return this.onPurchaseChanged(job.data.purchaseId, 'fulfillment', job.data.next);
                case 'PURCHASE_STATUS_CHANGED':
                    return this.onPurchaseChanged(job.data.purchaseId, 'status', job.data.next);
            }
        } catch (err) {
            log.error({ ...ctx, err }, 'job failed');
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

        // Shop-комментарий в обсуждении: ждём, пока handler is_automatic_forward
        // проиндексирует discussionMessageId (обычно <1s, но Telegram задерживает доставку).
        const discussionId = await getOrInitDiscussionChatId(this.api);
        if (!discussionId) {
            log.warn({ itemId, messageId }, 'no discussion chat, shop comment skipped');
            return;
        }
        const autoForwardId = await getDiscussionMessageStore().waitFor(channelId, messageId);
        log.info(
            { itemId, messageId, autoForwardId, attached: autoForwardId != null },
            'createPost: shop comment attempt',
        );
        if (autoForwardId == null) {
            log.warn(
                { itemId, messageId },
                'createPost: autoforward not indexed in time, shop comment sent unattached',
            );
        }
        await this.tg
            .sendComment(
                discussionId,
                this.renderer.shopCommentText,
                autoForwardId ?? undefined,
                shopInlineKeyboardForGroup(),
            )
            .catch((err) => log.error({ itemId, messageId, err }, 'shop comment failed'));

        log.info({ itemId, messageId }, 'createPost done');
    }

    private async deletePost(itemId: number): Promise<void> {
        const item = await this.db.purchaseItem.findUnique({
            where: { id: itemId },
            select: { tgChannelId: true, tgMessageId: true },
        });
        if (!item?.tgChannelId || !item.tgMessageId) {
            log.warn({ itemId }, 'deletePost: no post to delete');
            return;
        }
        await this.tg.deletePost(item.tgChannelId, Number(item.tgMessageId));
        log.info({ itemId, messageId: item.tgMessageId }, 'deletePost done');
    }

    // ── Реакции ────────────────────────────────────────────────

    private async rejectUserOrders(messageIds: string[]): Promise<void> {
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

    private async onPurchaseChanged(
        purchaseId: number,
        kind: 'fulfillment' | 'status',
        next: string,
    ): Promise<void> {
        const purchase = await this.db.purchase.findUnique({
            where: { id: purchaseId },
            include: { items: { include: ITEM_INCLUDE } },
        });
        if (!purchase) {
            log.warn({ purchaseId }, 'onPurchaseChanged: purchase not found');
            return;
        }

        let postsEdited = 0;
        for (const item of purchase.items) {
            if (!item.tgMessageId) continue;
            if (item.hidden) continue;
            await tryEditItemPost(this.tg, this.renderer, item);
            postsEdited++;
        }

        const channelId = getChannelIdFromEnv()!;
        const discussionId = await getOrInitDiscussionChatId(this.api);
        if (!discussionId) {
            log.warn({ purchaseId, kind, next, postsEdited }, 'onPurchaseChanged: no discussion chat');
            return;
        }

        const store = getDiscussionMessageStore();
        let commentsSent = 0;
        for (const item of purchase.items) {
            if (!item.tgMessageId) continue;
            if (item.hidden) continue;
            const postId = Number(item.tgMessageId);
            const autoForwardId = await store.get(channelId, postId);
            const data = { status: next, channelPostMessageId: postId };
            const text =
                kind === 'fulfillment'
                    ? this.renderer.buildFulfillmentComment(data)
                    : this.renderer.buildPurchaseStatusComment(data);
            if (!text) continue;
            await this.tg.sendComment(discussionId, text, autoForwardId ?? undefined);
            commentsSent++;
        }
        log.info(
            { purchaseId, kind, next, items: purchase.items.length, postsEdited, commentsSent },
            'onPurchaseChanged done',
        );
    }
}

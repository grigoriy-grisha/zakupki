import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { PurchaseRepository } from '../domain/purchase.repository';
import { PurchaseService } from '../services/purchase.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, publicProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { purchase: new PurchaseService(new PurchaseRepository(db)) };
}

// Telegram chat_id: либо @username, либо число (для канала/супергруппы должно
// начинаться с -100). Если пришло "1003537022316" без минуса — починим автоматически.
function normalizeChatId(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('@') || trimmed.startsWith('-')) return trimmed;
    if (/^100\d+$/.test(trimmed)) return `-${trimmed}`;
    return trimmed;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Конвертирует HTML из Tiptap (Novel) в подмножество HTML, которое понимает Telegram */
function htmlToTelegramHtml(html: string): string {
    let s = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '\n<b>')
        .replace(/<\/h[1-6]>/gi, '</b>\n')
        .replace(/<strong[^>]*>/gi, '<b>')
        .replace(/<\/strong>/gi, '</b>')
        .replace(/<em[^>]*>/gi, '<i>')
        .replace(/<\/em>/gi, '</i>')
        .replace(/<(del|strike)[^>]*>/gi, '<s>')
        .replace(/<\/(del|strike)>/gi, '</s>')
        .replace(/<mark[^>]*>/gi, '')
        .replace(/<\/mark>/gi, '')
        .replace(/<hr\s*\/?>/gi, '\n———\n')
        .replace(/<blockquote[^>]*>/gi, '\n')
        .replace(/<\/blockquote>/gi, '\n')
        .replace(/<ul[^>]*>/gi, '\n')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '\n')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<div[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '');

    // Декодируем основные HTML-entities, но оставляем разрешённые теги
    s = s.replace(/&nbsp;/g, ' ');

    // Удаляем все теги, кроме поддерживаемых Telegram: b, i, u, s, code, pre, a
    s = s.replace(/<(?!\/?(b|i|u|s|code|pre|a)(\s|>|\/))[^>]*>/gi, '');

    s = s.replace(/\n{3,}/g, '\n\n').trim();
    return s;
}

interface PostProduct {
    name: string;
    sku: string | null;
    description: string | null;
    pricePerUnit: unknown;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unit: { shortName: string } | null;
}

function buildProductPostText(product: PostProduct, purchaseTag: string): string {
    const header = `📦 <b>Закупка ${escapeHtml(purchaseTag)}</b>\n\n`;

    const desc = product.description?.trim();
    if (desc) {
        return header + htmlToTelegramHtml(desc);
    }

    // Фолбэк, если описание пустое
    const lines: string[] = [`<b>${escapeHtml(product.name)}</b>`];
    if (product.sku?.trim()) lines.push(escapeHtml(product.sku.trim()));

    if (product.minPackageAmount != null && product.minPackageUnit) {
        lines.push(
            `Минимальная фасовка — ${Number(product.minPackageAmount)} ${escapeHtml(product.minPackageUnit)}`,
        );
    }

    const price = Number(product.pricePerUnit);
    const shortName = product.unit?.shortName ?? 'ед.';
    if (Number.isFinite(price) && price > 0) {
        lines.push(`${price.toLocaleString('ru-RU')} ₽/${escapeHtml(shortName)}`);
    }

    return header + lines.join('\n');
}

interface TgSendResult {
    ok: boolean;
    messageId?: number;
    error?: string;
}

async function sendTelegramPost(botToken: string, chatId: string, text: string): Promise<TgSendResult> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text.slice(0, 4096),
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            }),
        });

        const data = (await res.json()) as {
            ok: boolean;
            description?: string;
            result?: { message_id: number };
        };

        if (!data.ok || !data.result?.message_id) {
            const detail = data.description ?? `HTTP ${res.status}`;
            console.error('[TG] sendMessage failed:', detail, { chatId });
            return { ok: false, error: detail };
        }

        return { ok: true, messageId: data.result.message_id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'fetch failed';
        console.error('[TG] sendMessage exception:', msg);
        return { ok: false, error: msg };
    }
}

interface TgPublishOutcome {
    purchaseItemId: number;
    productName: string;
    ok: boolean;
    error?: string;
}

export const purchasesRouter = router({
    list: publicProcedure
        .input(
            z.object({
                status: z.string().optional(),
                statuses: z.array(z.string()).optional(),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            if (input?.statuses?.length) {
                return purchase.listByStatuses(input.statuses);
            }
            return purchase.list(input?.status);
        }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
        const { purchase } = services(ctx.db);
        return purchase.getById(input.id);
    }),

    create: adminProcedure
        .input(
            z.object({
                tag: z.string().min(1),
                supplier: z.string().min(1),
                minAmount: z.number().positive(),
                deadline: z.string().transform((v) => new Date(v)),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.create(input);
        }),

    updateStatus: adminProcedure
        .input(z.object({ id: z.number(), status: z.enum(['DRAFT', 'ACTIVE', 'SUPPLEMENT', 'CLOSED', 'ARRIVED', 'DONE']) }))
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.updateStatus(input.id, input.status);
        }),

    setAvailableQuantities: adminProcedure
        .input(
            z.object({
                purchaseId: z.number(),
                items: z.array(z.object({
                    purchaseItemId: z.number(),
                    availableQty: z.number().nullable(),
                })),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            return purchase.setAvailableQuantities(input.purchaseId, input.items);
        }),

    addItems: adminProcedure
        .input(z.object({
            purchaseId: z.number(),
            productIds: z.array(z.number()).min(1, 'Выберите хотя бы один товар'),
            publishToTg: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { purchase } = services(ctx.db);
            const items = await purchase.addItems(input.purchaseId, input.productIds);

            const tgOutcomes: TgPublishOutcome[] = [];

            if (input.publishToTg) {
                const botToken = process.env.BOT_TOKEN?.trim();
                const rawChatId = (process.env.TELEGRAM_CHANNEL_ID ?? process.env.TG_CHANNEL_ID)?.trim();

                if (!botToken) {
                    console.error('[TG] BOT_TOKEN не задан');
                    throw new TRPCError({
                        code: 'PRECONDITION_FAILED',
                        message: 'BOT_TOKEN не задан в .env. Товары добавлены, но не опубликованы.',
                    });
                }

                if (!rawChatId) {
                    console.error('[TG] TG_CHANNEL_ID не задан');
                    throw new TRPCError({
                        code: 'PRECONDITION_FAILED',
                        message: 'TG_CHANNEL_ID не задан в .env. Товары добавлены, но не опубликованы.',
                    });
                }

                const chatId = normalizeChatId(rawChatId);
                console.log(`[TG] Публикация ${items.length} товаров в ${chatId}`);

                // Подтягиваем полные данные о товарах (с описанием и unit)
                const fullItems = await ctx.db.purchaseItem.findMany({
                    where: { id: { in: items.map((i) => i.id) } },
                    include: { product: { include: { unit: true } } },
                });

                const purchaseRow = await ctx.db.purchase.findUnique({
                    where: { id: input.purchaseId },
                    select: { tag: true },
                });
                const purchaseTag = purchaseRow?.tag ?? `#${input.purchaseId}`;

                for (const item of fullItems) {
                    if (!item.product) {
                        tgOutcomes.push({
                            purchaseItemId: item.id,
                            productName: `#${item.id}`,
                            ok: false,
                            error: 'Товар не найден',
                        });
                        continue;
                    }

                    const text = buildProductPostText(item.product, purchaseTag);
                    const result = await sendTelegramPost(botToken, chatId, text);

                    if (result.ok && result.messageId) {
                        await ctx.db.purchaseItem.update({
                            where: { id: item.id },
                            data: {
                                tgMessageId: String(result.messageId),
                                tgChannelId: chatId,
                            },
                        });
                        tgOutcomes.push({
                            purchaseItemId: item.id,
                            productName: item.product.name,
                            ok: true,
                        });
                    } else {
                        tgOutcomes.push({
                            purchaseItemId: item.id,
                            productName: item.product.name,
                            ok: false,
                            error: result.error,
                        });
                    }
                }
            }

            return { items, tgPublish: input.publishToTg ? tgOutcomes : null };
        }),

    publishItemToTg: adminProcedure
        .input(z.object({ purchaseItemId: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const botToken = process.env.BOT_TOKEN?.trim();
            const rawChatId = (process.env.TELEGRAM_CHANNEL_ID ?? process.env.TG_CHANNEL_ID)?.trim();

            if (!botToken) {
                throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'BOT_TOKEN не задан' });
            }
            if (!rawChatId) {
                throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'TG_CHANNEL_ID не задан' });
            }

            const chatId = normalizeChatId(rawChatId);

            const item = await ctx.db.purchaseItem.findUnique({
                where: { id: input.purchaseItemId },
                include: {
                    product: { include: { unit: true } },
                    purchase: { select: { tag: true } },
                },
            });

            if (!item?.product) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Товар не найден' });
            }

            const text = buildProductPostText(item.product, item.purchase.tag);
            const result = await sendTelegramPost(botToken, chatId, text);

            if (!result.ok || !result.messageId) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Telegram: ${result.error ?? 'unknown error'}`,
                });
            }

            await ctx.db.purchaseItem.update({
                where: { id: input.purchaseItemId },
                data: { tgMessageId: String(result.messageId), tgChannelId: chatId },
            });

            return { ok: true, messageId: result.messageId };
        }),

    removeItem: adminProcedure.input(z.object({ purchaseItemId: z.number() })).mutation(async ({ ctx, input }) => {
        const { purchase } = services(ctx.db);
        return purchase.removeItem(input.purchaseItemId);
    }),
});

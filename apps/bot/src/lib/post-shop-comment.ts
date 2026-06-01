import type { Api } from 'grammy';
import { GrammyError } from 'grammy';

import { getLinkedDiscussionChatId } from './channel-discussion';
import { shopUrlKeyboard } from './webapp-url';

export const SHOP_COMMENT_TEXT = '👇 Оформить заказ в магазине:';

const recentlyCommented = new Set<number>();

export function markShopCommentPosted(channelPostId: number) {
    recentlyCommented.add(channelPostId);
    setTimeout(() => recentlyCommented.delete(channelPostId), 120_000);
}

export function wasShopCommentPosted(channelPostId: number): boolean {
    return recentlyCommented.has(channelPostId);
}

export function shopCommentReplyOptions(discussionMessageId: number) {
    const replyMarkup = shopUrlKeyboard();
    return {
        reply_parameters: { message_id: discussionMessageId },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
}

/** Ждём, пока обработчик пересылки отправит reply (только для лога в воркере). */
export function waitUntilShopCommentPosted(channelPostId: number, timeoutMs: number): Promise<boolean> {
    if (wasShopCommentPosted(channelPostId)) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const tick = () => {
            if (wasShopCommentPosted(channelPostId)) {
                resolve(true);
                return;
            }
            if (Date.now() >= deadline) {
                resolve(false);
                return;
            }
            setTimeout(tick, 300);
        };
        tick();
    });
}

/** Запасной вариант: комментарий в теме обсуждения (message_thread_id = id поста в канале). */
export async function postShopCommentInDiscussion(api: Api, channelPostMessageId: number): Promise<boolean> {
    if (wasShopCommentPosted(channelPostMessageId)) return true;

    const discussionId = getLinkedDiscussionChatId();
    if (!discussionId) return false;

    const replyMarkup = shopUrlKeyboard();
    try {
        await api.sendMessage(discussionId, SHOP_COMMENT_TEXT, {
            message_thread_id: channelPostMessageId,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
        markShopCommentPosted(channelPostMessageId);
        console.log(`[TG] Shop comment in discussion thread ${channelPostMessageId}`);
        return true;
    } catch {
        return false;
    }
}

export async function postShopCommentInDiscussionWithRetry(
    api: Api,
    channelPostMessageId: number,
    timeoutMs = 30_000,
): Promise<boolean> {
    if (wasShopCommentPosted(channelPostMessageId)) return true;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await postShopCommentInDiscussion(api, channelPostMessageId)) return true;
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

export function formatShopCommentError(err: unknown): string {
    if (err instanceof GrammyError) {
        return `${err.error_code}: ${err.description}`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

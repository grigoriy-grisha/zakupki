import { GrammyError } from 'grammy';

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

export function formatShopCommentError(err: unknown): string {
    if (err instanceof GrammyError) {
        return `${err.error_code}: ${err.description}`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

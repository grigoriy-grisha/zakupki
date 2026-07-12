import type { Api } from 'grammy';
import { GrammyError, InputFile } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { loadProductPhoto } from '@zakupki/storage';
import { createLogger } from '@zakupki/logger';

import { TELEGRAM_CAPTION_MAX, TELEGRAM_MESSAGE_MAX } from '../domain/constants';
import type { ChannelPostPhoto } from '../domain/types';
import type { BotConfig } from '../config/bot-config';

const log = createLogger('tg-client');

const HTML_OPTS = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } };

/** Photo loaded from storage. */
type StoredPhoto = { id: number; objectKey: string; mimeType: string };

/**
 * Единая точка общения с Telegram API. Все вызовы `bot.api.*` — только здесь.
 * Никаких fallback-обвязок: renderer гарантирует валидный HTML, BullMQ ретраит.
 */
export class TgClient {
    constructor(
        private readonly _api: Api,
        private readonly cfg: BotConfig,
    ) {}

    /** Доступ к grammY Api нужен в нескольких местах (например, ChannelDiscussion.init). */
    get api(): Api {
        return this._api;
    }

    // ── Посты в канале ──────────────────────────────────────────

    async sendPost(
        chatId: string,
        text: string,
        photo?: ChannelPostPhoto | null,
    ): Promise<{ messageId: number }> {
        if (photo?.data.length) {
            const caption = text.slice(0, TELEGRAM_CAPTION_MAX);
            const msg = await this.api.sendPhoto(chatId, new InputFile(photo.data, photoFilename(photo.mimeType)), {
                caption,
                parse_mode: 'HTML',
            });
            log.info({ chatId, messageId: msg.message_id, kind: 'photo' }, 'sendPost');
            return { messageId: msg.message_id };
        }
        const msg = await this.api.sendMessage(chatId, text.slice(0, TELEGRAM_MESSAGE_MAX), HTML_OPTS);
        log.info({ chatId, messageId: msg.message_id, kind: 'text' }, 'sendPost');
        return { messageId: msg.message_id };
    }

    async editPost(
        chatId: string,
        messageId: number,
        text: string,
        photo?: ChannelPostPhoto | null,
    ): Promise<void> {
        // "message is not modified" — это НЕ ошибка, это значит "контент идентичен
        // текущему, ничего не делаем". Без этого catch worker падает, BullMQ ретраит
        // 5 раз, джоба фейлится, пост НЕ обновляется (потому что не обновлять
        // нечего — он уже актуальный).
        try {
            if (photo?.data.length) {
                await this.api.editMessageCaption(chatId, messageId, {
                    caption: text.slice(0, TELEGRAM_CAPTION_MAX),
                    parse_mode: 'HTML',
                });
                log.info({ chatId, messageId, kind: 'caption' }, 'editPost');
                return;
            }
            await this.api.editMessageText(chatId, messageId, text.slice(0, TELEGRAM_MESSAGE_MAX), HTML_OPTS);
            log.info({ chatId, messageId, kind: 'text' }, 'editPost');
        } catch (err) {
            if (err instanceof GrammyError && err.description.includes('message is not modified')) {
                log.debug({ chatId, messageId }, 'editPost: content unchanged, skip');
                return;
            }
            throw err;
        }
    }

    async deletePost(chatId: string, messageId: number): Promise<void> {
        try {
            await this.api.deleteMessage(chatId, messageId);
            log.info({ chatId, messageId }, 'deletePost');
        } catch (err) {
            // "message to delete not found" — не ошибка, пост уже удалён
            if (err instanceof GrammyError && err.description.includes('message to delete not found')) {
                log.info({ chatId, messageId }, 'deletePost: already gone');
                return;
            }
            log.error({ chatId, messageId, err }, 'deletePost failed');
            throw err;
        }
    }

    // ── Комментарии в обсуждении ────────────────────────────────

    async sendComment(
        chatId: string,
        text: string,
        replyToMessageId?: number,
        replyMarkup?: InlineKeyboardMarkup,
    ): Promise<void> {
        await this.api.sendMessage(chatId, text, {
            ...HTML_OPTS,
            ...(replyToMessageId != null ? { reply_parameters: { message_id: replyToMessageId } } : {}),
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
        log.info({ chatId, replyToMessageId, len: text.length }, 'sendComment');
    }

    // ── Реакции ─────────────────────────────────────────────────

    async setReaction(chatId: string, messageId: number, emoji: string): Promise<void> {
        await this.api.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji: emoji as '👎' }]);
        log.info({ chatId, messageId, emoji }, 'setReaction');
    }

    // ── Фото ────────────────────────────────────────────────────

    /**
     * Загружает фото из storage с fallback на WEBAPP_URL/api/photos/{id}.
     * Возвращает null если файл недоступен.
     */
    async loadPhoto(photo: StoredPhoto): Promise<ChannelPostPhoto | null> {
        try {
            const data = await loadProductPhoto(photo.objectKey);
            if (data?.length) {
                log.debug({ photoId: photo.id, source: 'storage' }, 'photo loaded');
                return { data, mimeType: photo.mimeType || 'image/jpeg' };
            }
        } catch (err) {
            log.warn({ photoId: photo.id, err }, 'loadProductPhoto failed');
        }

        const webappUrl = this.cfg.webapp.photoBaseUrl;
        if (webappUrl) {
            try {
                const resp = await fetch(`${webappUrl}/api/photos/${photo.id}`);
                if (resp.ok) {
                    const arrayBuf = await resp.arrayBuffer();
                    log.debug({ photoId: photo.id, source: 'webapp' }, 'photo loaded');
                    return { data: Buffer.from(arrayBuf), mimeType: photo.mimeType || 'image/jpeg' };
                }
                log.warn({ photoId: photo.id, status: resp.status }, 'webapp photo fetch failed');
            } catch (err) {
                log.warn({ photoId: photo.id, err }, 'webapp photo fetch error');
            }
        }

        log.warn({ photoId: photo.id }, 'photo unavailable');
        return null;
    }
}

function photoFilename(mimeType: string): string {
    if (mimeType === 'image/png') return 'photo.png';
    if (mimeType === 'image/webp') return 'photo.webp';
    if (mimeType === 'image/gif') return 'photo.gif';
    return 'photo.jpg';
}

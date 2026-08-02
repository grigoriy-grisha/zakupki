import { GrammyError } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import type { UserDmJob } from '@zakupki/queue';
import { getUserDmJobsQueue } from '@zakupki/queue';
import { createLogger } from '@zakupki/logger';

import { NotificationRepository } from '../../domain/notification.repository';
import { UserRepository } from '../../domain/user.repository';
import { getActiveBotConfig } from '../config/bot-config';
import type { TgClient } from '../lib/tg-client';

const log = createLogger('user-dm-worker');

/**
 * Consumer of the `user-dm-jobs` queue. For each job it loads the Notification
 * row, resolves the recipient's Telegram id, and sends the rendered body as a
 * direct message via `TgClient.sendDm`.
 *
 * Idempotency: the row's `tgDeliveredAt` is the dedup gate — both at start
 * (skip if already delivered) and on success / permanent failure (stamp it).
 *
 * Failure policy:
 *   - Permanent (user blocked the bot, account deactivated, chat not found):
 *     mark `tgDeliveredAt` and swallow. Don't retry — the row still shows in
 *     the web bell.
 *   - Transient (rate limit, network): rethrow so BullMQ applies its backoff.
 *   - VK-only users (no `telegramCredential`): skip DM, mark delivered. The
 *     web bell is their only channel.
 */
export class UserDmWorker {
    constructor(
        private readonly tg: TgClient,
        private readonly userRepo: UserRepository,
        private readonly notifRepo: NotificationRepository,
    ) {}

    setupWorker(): void {
        const queue = getUserDmJobsQueue();
        queue.setupWorker({
            handler: (job) => this.process(job),
            onFailed: (job, err, final) => {
                log.error({ jobId: job.id, notificationId: job.data.notificationId, err, final }, 'DM delivery failed');
            },
        });
        log.info('UserDmWorker started');
    }

    private async process(job: { id?: string; data: UserDmJob }): Promise<void> {
        const { notificationId } = job.data;

        const notif = await this.notifRepo.findById(notificationId);
        if (!notif) {
            log.warn({ notificationId }, 'notification not found, skip');
            return;
        }
        // Idempotency: another worker attempt already delivered or permanently gave up.
        if (notif.tgDeliveredAt) {
            log.debug({ notificationId }, 'already delivered, skip');
            return;
        }

        const telegramId = await this.userRepo.findTelegramIdByUserId(notif.userId);
        if (!telegramId) {
            // VK-only / admin-created user — no DM channel. Web bell still works.
            log.info({ notificationId, userId: notif.userId }, 'no telegramId, skip DM');
            await this.notifRepo.markTgDelivered(notificationId);
            return;
        }

        try {
            // Body is stored as Telegram-HTML (see NotificationService.notify —
            // it calls renderNotificationTelegramBody which already HTML-
            // escapes any user-supplied bits: product names, admin notes,
            // purchase tags). Send as-is — wrapping in escapeHtml again would
            // double-escape the markup and turn <b> into &lt;b&gt; in the chat.
            const keyboard = buildOpenPurchaseKeyboard(notif.payload);
            await this.tg.sendDm(telegramId, notif.body, keyboard ?? undefined);
            await this.notifRepo.markTgDelivered(notificationId);
        } catch (err) {
            if (isPermanentTelegramError(err)) {
                // Don't retry forever — the user will see it in the web bell anyway.
                log.warn({ notificationId, telegramId, err: errMsg(err) }, 'permanent DM failure, marking delivered');
                await this.notifRepo.markTgDelivered(notificationId);
                return;
            }
            // Transient: rethrow so BullMQ retries with exponential backoff.
            throw err;
        }
    }
}

/**
 * Detect Telegram errors that will never succeed on retry: the user blocked
 * the bot, deleted their account, or never started a chat with the bot (which
 * Telegram reports as "chat not found"). All of these are 400/403 from the API.
 */
function isPermanentTelegramError(err: unknown): boolean {
    if (!(err instanceof GrammyError)) return false;
    const desc = err.description.toLowerCase();
    return (
        desc.includes('bot was blocked by the user') ||
        desc.includes('user is deactivated') ||
        desc.includes('chat not found') ||
        desc.includes('chat_does_not_exist') ||
        desc.includes('user_not_found')
    );
}

function errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

/**
 * Build an inline keyboard with an "Открыть закупку" button that opens the
 * Telegram Mini App straight at the purchase the notification refers to.
 *
 * The button uses `web_app` when WEBAPP_URL is HTTPS (native Mini App — opens
 * inside Telegram, no browser redirect) and falls back to a plain `url` button
 * otherwise (dev on localhost, where web_app is rejected by Telegram). Returns
 * `null` when there's no purchase id in the payload or no Mini App URL
 * configured — in that case the DM is still sent, just without the button.
 *
 * `payload` is the raw JSON column — we only read `purchaseId`, defensively.
 */
function buildOpenPurchaseKeyboard(payload: unknown): InlineKeyboardMarkup | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const purchaseId = (payload as { purchaseId?: unknown }).purchaseId;
    if (typeof purchaseId !== 'number' || !Number.isFinite(purchaseId)) return null;

    const cfg = getActiveBotConfig();
    const baseUrl = cfg.webapp.miniAppUrl ?? cfg.webapp.url;
    if (!baseUrl) return null;

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/tg/webapp/shop/purchase/${purchaseId}`;

    // web_app requires HTTPS — in dev (localhost) fall back to a t.me-style url.
    let isHttps = false;
    try {
        isHttps = new URL(targetUrl).protocol === 'https:';
    } catch {
        isHttps = false;
    }

    if (isHttps) {
        return {
            inline_keyboard: [[{ text: 'Открыть закупку', web_app: { url: targetUrl } }]],
        };
    }
    return {
        inline_keyboard: [[{ text: 'Открыть закупку', url: targetUrl }]],
    };
}

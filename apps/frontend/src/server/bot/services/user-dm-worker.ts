import { GrammyError } from 'grammy';
import type { UserDmJob } from '@zakupki/queue';
import { getUserDmJobsQueue } from '@zakupki/queue';
import { createLogger } from '@zakupki/logger';

import { NotificationRepository } from '../../domain/notification.repository';
import { UserRepository } from '../../domain/user.repository';
import { getActiveBotConfig } from '../config/bot-config';
import { buildOpenPurchaseKeyboard } from '../lib/dm-keyboard';
import type { TgClient } from '../lib/tg-client';

const log = createLogger('user-dm-worker');

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

    async requeueUndelivered(): Promise<void> {
        try {
            const ids = await this.notifRepo.findUndeliveredIds();
            const queue = getUserDmJobsQueue();
            for (const id of ids) {
                await queue.addImmediate({ type: 'SEND_DM', notificationId: id });
            }
            if (ids.length > 0) {
                log.info({ count: ids.length }, 'requeued undelivered DM notifications');
            }
        } catch (err) {
            log.error({ err }, 'failed to requeue undelivered DM notifications');
        }
    }

    private async process(job: { id?: string; data: UserDmJob }): Promise<void> {
        const { notificationId } = job.data;

        const notif = await this.notifRepo.findById(notificationId);
        if (!notif) {
            log.warn({ notificationId }, 'notification not found, skip');
            return;
        }
        if (notif.tgDeliveredAt) {
            log.debug({ notificationId }, 'already delivered, skip');
            return;
        }

        const telegramId = await this.userRepo.findTelegramIdByUserId(notif.userId);
        if (!telegramId) {
            log.info({ notificationId, userId: notif.userId }, 'no telegramId, skip DM');
            await this.notifRepo.markTgDelivered(notificationId);
            return;
        }

        try {
            const keyboard = buildOpenPurchaseKeyboard(notif.payload, getActiveBotConfig());
            await this.tg.sendDm(telegramId, notif.body, keyboard ?? undefined);
            await this.notifRepo.markTgDelivered(notificationId);
        } catch (err) {
            if (isPermanentTelegramError(err)) {
                log.warn({ notificationId, telegramId, err: errMsg(err) }, 'permanent DM failure, marking delivered');
                await this.notifRepo.markTgDelivered(notificationId);
                return;
            }
            throw err;
        }
    }
}

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

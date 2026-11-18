import { createLogger } from '@zakupki/logger';
import { GrammyError } from 'grammy';

import type { SyncResult } from '@/server/services/online-payment.service';

import type { ServiceContainer } from '../../container/service-container';
import type { CommandHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { consentKeyboard, consentText, welcomeText } from '../../lib/consent';
import { PAID_START_PAYLOAD } from '../../lib/payment-return';
import { getWebAppUrl, shopStartKeyboard } from '../../lib/webapp-url';

const log = createLogger('start-command');

/**
 * /start — welcome + shop button. Если согласие на обработку ПД ещё не дано —
 * вместо приветствия показываем запрос согласия с кнопкой подтверждения.
 */
export class StartCommand implements CommandHandler {
    readonly command = 'start';
    readonly requireAuth = false;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext): Promise<void> {
        const name = ctx.from?.first_name ?? 'Друг';

        const userId = ctx.session.userId;

        // Клиент вернулся из банка после оплаты — сразу сверяем статус, не дожидаясь уведомления банка.
        if (userId != null && ctx.match === PAID_START_PAYLOAD) {
            await this.handlePaymentReturn(ctx, userId);
            return;
        }

        if (userId != null) {
            try {
                const consented = await this.container.userService.hasPersonalDataConsent(userId);
                if (!consented) {
                    await ctx.reply(consentText(name), { reply_markup: consentKeyboard() });
                    return;
                }
            } catch (err) {
                log.warn({ err }, 'consent check failed, showing regular welcome');
            }
        }

        const text = welcomeText(name, !!getWebAppUrl());
        const replyMarkup = shopStartKeyboard();

        try {
            await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
        } catch (err) {
            if (err instanceof GrammyError && replyMarkup) {
                log.warn({ description: err.description }, 'reply with button failed');
                await ctx.reply(text);
                return;
            }
            log.error({ err }, 'start command failed');
            throw err;
        }
    }

    private async handlePaymentReturn(ctx: CustomContext, userId: number): Promise<void> {
        let result: SyncResult | null = null;
        try {
            result = await this.container.paymentService.syncOnlinePayments(userId);
        } catch (err) {
            log.warn({ err, userId }, 'payment return: sync failed');
        }
        // Прошедшая оплата — подтверждение уже ушло отдельным сообщением.
        if (result && result.confirmed > 0) return;
        if (result && result.rejected > 0) {
            await ctx.reply('Оплата не прошла. Попробуйте ещё раз: /pay\n\nСтатус оплат: /payments');
            return;
        }
        if (result && result.open === 0) {
            await ctx.reply('Незавершённых оплат нет. Статус оплат: /payments');
            return;
        }
        await ctx.reply(
            'Проверяю оплату в банке. Как только она пройдёт, пришлю подтверждение.\n\nСтатус оплат: /payments',
        );
    }
}

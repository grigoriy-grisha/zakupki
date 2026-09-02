import { createLogger } from '@zakupki/logger';
import { GrammyError } from 'grammy';

import type { ServiceContainer } from '../../container/service-container';
import type { CommandHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { consentKeyboard, consentText, welcomeText } from '../../lib/consent';
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
}

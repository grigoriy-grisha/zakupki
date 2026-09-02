import type { ServiceContainer } from '../../container/service-container';
import type { CallbackAction } from '../../domain/callback-data';
import type { CallbackHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';
import { welcomeText } from '../../lib/consent';
import { getWebAppUrl, shopStartKeyboard } from '../../lib/webapp-url';

/**
 * consent:accept — сохраняет согласие на обработку ПД и заменяет сообщение
 * на обычное приветствие с кнопкой приложения.
 */
export class ConsentCallbackQueryHandler implements CallbackHandler {
    readonly prefix = 'consent:';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, action: CallbackAction): Promise<void> {
        if (action.kind !== 'consent:accept') {
            await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
            return;
        }

        const userId = ctx.session.userId;
        if (userId == null) {
            await ctx.answerCallbackQuery({ text: 'Сначала нажмите /start' }).catch(() => undefined);
            return;
        }

        await this.container.userService.acceptPersonalDataConsent(userId);
        await ctx.answerCallbackQuery({ text: 'Спасибо! Согласие сохранено' });

        const name = ctx.from?.first_name ?? 'Друг';
        const text = welcomeText(name, !!getWebAppUrl());
        const replyMarkup = shopStartKeyboard();
        try {
            await ctx.editMessageText(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
        } catch {
            await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
        }
    }
}

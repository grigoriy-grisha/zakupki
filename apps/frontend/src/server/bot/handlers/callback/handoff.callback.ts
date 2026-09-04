import {
    type NotificationPayload,
    type NotificationType,
    renderNotificationTelegramBody,
} from '@zakupki/types';

import type { ServiceContainer } from '../../container/service-container';
import type { CallbackAction } from '../../domain/callback-data';
import type { CallbackHandler } from '../../domain/handler';
import type { CustomContext } from '../../domain/types';

export class HandoffCallbackQueryHandler implements CallbackHandler {
    readonly prefix = 'handoff:';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, action: CallbackAction): Promise<void> {
        if (action.kind !== 'handoff:store' && action.kind !== 'handoff:ship') {
            await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
            return;
        }

        const userId = ctx.session.userId;
        if (userId == null) {
            await ctx.answerCallbackQuery({ text: 'Сначала нажмите /start' }).catch(() => undefined);
            return;
        }

        const choice = action.kind === 'handoff:store' ? 'STORED' : 'READY_TO_SHIP';
        const type: NotificationType =
            action.kind === 'handoff:store' ? 'ORDER_HANDOFF_STORED' : 'ORDER_HANDOFF_SHIP_REQUEST';

        try {
            const { purchaseId, purchaseTag } = await this.container.orderService.setHandoffChoice(
                action.purchaseOrderId,
                userId,
                choice,
            );
            await ctx.answerCallbackQuery({ text: 'Готово' });
            const text = renderNotificationTelegramBody(type, {
                purchaseId,
                purchaseTag,
            } as NotificationPayload<typeof type>);
            try {
                await ctx.editMessageText(text);
            } catch {
                await ctx.reply(text);
            }
        } catch {
            await ctx.answerCallbackQuery({ text: 'Не удалось обновить статус', show_alert: true }).catch(
                () => undefined,
            );
        }
    }
}

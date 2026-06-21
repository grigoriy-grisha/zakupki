import { InlineKeyboard } from 'grammy';

import type { CustomContext } from '../../domain/types';
import { PaymentFlowStateMachine } from '../../services/payment-flow-state-machine';
import type { CallbackHandler } from '../../domain/handler';
import type { CallbackAction } from '../../domain/callback-data';
import type { ServiceContainer } from '../../container/service-container';

/**
 * Обрабатывает callback'и с префиксом `pay:`.
 */
export class PayCallbackQueryHandler implements CallbackHandler {
    readonly prefix = 'pay:';
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, action: CallbackAction): Promise<void> {
        const userId = ctx.session.userId!;

        if (action.kind === 'pay:pick') {
            await this.handlePick(ctx, userId, action.purchaseId);
            return;
        }

        if (action.kind === 'pay:all') {
            await this.handleAll(ctx, userId, action.purchaseId);
            return;
        }

        await ctx.answerCallbackQuery({ text: 'Неизвестное действие' }).catch(() => undefined);
    }

    private async handlePick(ctx: CustomContext, userId: number, purchaseId: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            await ctx.editMessageText('Эта закупка больше недоступна для оплаты. Нажмите /pay снова.');
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startAmountStep(purchaseId, info.tag, info.remaining);

        const keyboard = new InlineKeyboard().text(
            `Оплатить всё (${info.remaining.toLocaleString('ru-RU')} ₽)`,
            `pay:all:${purchaseId}`,
        );

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
            `Закупка «${info.tag}»\n` +
                `К оплате: ${info.remaining.toLocaleString('ru-RU')} ₽\n\n` +
                `Введите сумму в рублях или нажмите кнопку ниже.`,
            { reply_markup: keyboard },
        );
    }

    private async handleAll(ctx: CustomContext, userId: number, purchaseId: number): Promise<void> {
        const guard = this.container.paymentGuard;
        if (!(await guard.isOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await this.container.paymentService.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            return;
        }

        const flow = this.container.flowFor(ctx);
        flow.startProofStep(purchaseId, info.tag, info.remaining, info.remaining);

        await ctx.answerCallbackQuery();
        await ctx.reply(
            `Сумма: ${info.remaining.toLocaleString('ru-RU')} ₽\n\n` +
                `Пришлите фото или PDF чека об оплате.\n` +
                `Комментарий можно добавить в подписи к файлу.\n\n` +
                `/cancel — отменить`,
        );
    }
}

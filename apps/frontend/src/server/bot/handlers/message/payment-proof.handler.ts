import { PROOF_MIME_BY_EXT, PROOF_MIME_TYPES } from '@zakupki/types';

import type { CustomContext } from '../../domain/types';
import { isPrivateChat } from '../shared/is-private-chat';
import type { MessageHandler } from '../../domain/handler';
import type { ServiceContainer } from '../../container/service-container';
import { downloadTelegramFile } from '../../lib/download-telegram-file';
import { PAYMENT_NOT_OPEN_MESSAGE } from '../../lib/purchase-payment-guard';

function messageHasPaymentFile(ctx: CustomContext): boolean {
    const message = ctx.message;
    if (!message) return false;
    return (
        ('photo' in message && Boolean(message.photo?.length)) || ('document' in message && Boolean(message.document))
    );
}

function mimeFromDocument(fileName: string | undefined, mimeType: string | undefined): string | null {
    if (mimeType && mimeType !== 'application/octet-stream') {
        return mimeType;
    }
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext && PROOF_MIME_BY_EXT[ext]) {
        return PROOF_MIME_BY_EXT[ext];
    }
    return null;
}

/**
 * PaymentProofHandler — обрабатывает photo/PDF-документ в payment flow.
 */
export class PaymentProofHandler implements MessageHandler {
    readonly filter = 'photo_or_doc' as const;
    readonly requireAuth = true;

    constructor(private readonly container: ServiceContainer) {}

    async handle(ctx: CustomContext, _next: () => Promise<void>): Promise<void> {
        if (!isPrivateChat(ctx) || !messageHasPaymentFile(ctx)) {
            return;
        }

        const flow = this.container.flowFor(ctx);

        if (flow.currentStep === 'amount') {
            await ctx.reply('Сначала укажите сумму оплаты числом. Фото чека примем после этого.');
            return;
        }

        const current = flow.current;
        if (!current || flow.currentStep !== 'proof' || current.amount == null) {
            return;
        }

        if (!(await this.container.paymentGuard.isOpenById(current.purchaseId))) {
            flow.clear();
            await ctx.reply(PAYMENT_NOT_OPEN_MESSAGE);
            return;
        }

        const message = ctx.message;
        if (!message) return;

        let fileId: string | undefined;
        let mimeType: string | null = null;

        if ('photo' in message && message.photo?.length) {
            const largest = message.photo[message.photo.length - 1];
            fileId = largest.file_id;
            mimeType = 'image/jpeg';
        } else if ('document' in message && message.document) {
            fileId = message.document.file_id;
            mimeType = mimeFromDocument(message.document.file_name, message.document.mime_type);
        }

        if (!fileId || !mimeType) {
            await ctx.reply('Пришлите фото чека или PDF-документ.');
            return;
        }
        if (!PROOF_MIME_TYPES.has(mimeType)) {
            await ctx.reply('Допустимы только изображения и PDF (до 5 МБ).');
            return;
        }

        const userComment = message.caption?.trim() || undefined;

        try {
            const proofData = await downloadTelegramFile(ctx.api, fileId, this.container.cfg.telegram.token);
            const promo = flow.promo;
            await this.container.paymentService.submitPaymentWithProof({
                userId: ctx.session.userId!,
                purchaseId: current.purchaseId,
                amount: current.amount,
                userComment,
                proofData,
                proofMimeType: mimeType,
                promoCodeId: promo?.id,
                discountAmount: promo?.discount,
            });

            flow.clear();

            const discountLine = promo
                ? `Скидка по промокоду: ${promo.discount.toLocaleString('ru-RU')} ₽\n`
                : '';
            await ctx.reply(
                `Оплата ${current.amount.toLocaleString('ru-RU')} ₽ по закупке «${current.purchaseTag}» отправлена на проверку.\n` +
                    discountLine +
                    `Статус: /payments`,
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Не удалось отправить оплату';
            await ctx.reply(msg);
        }
    }
}

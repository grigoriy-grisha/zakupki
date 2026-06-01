import { InlineKeyboard, type NextFunction } from 'grammy';

import type { CustomContext } from '../domain/types';
import { downloadTelegramFile } from '../lib/download-telegram-file';
import {
    isPurchasePaymentOpenById,
    PAYMENT_NOT_OPEN_MESSAGE,
} from '../lib/purchase-payment-guard';
import { PaymentService } from '../services/payment.service';
import { OrderService } from '../services/order.service';
import { isPurchasePaymentOpen } from '@zakupki/types';

const BOT_TOKEN = process.env.BOT_TOKEN ?? '';

const PROOF_MIME_BY_EXT: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
};

function isPrivateChat(ctx: CustomContext): boolean {
    return ctx.chat?.type === 'private';
}

function parseAmount(text: string): number | null {
    const normalized = text.replace(/\s/g, '').replace(',', '.');
    const value = Number(normalized);
    if (!Number.isFinite(value)) return null;
    return value;
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

export async function payCommand(ctx: CustomContext) {
    if (!isPrivateChat(ctx)) {
        await ctx.reply('Оплату через бота можно отправить только в личных сообщениях.');
        return;
    }

    const userId = ctx.session.userId!;
    const service = new PaymentService();
    const payable = await service.getPayablePurchases(userId);

    if (payable.length === 0) {
        const active = await new OrderService().getActivePurchases(userId);
        const waitingPayment = active.filter((p) => !isPurchasePaymentOpen(p.fulfillmentStatus));

        if (waitingPayment.length > 0) {
            await ctx.reply(
                'Сейчас нельзя отправить оплату.\n' +
                    'По вашим закупкам ещё не открыт приём оплаты — следите за статусом в /orders.\n\n' +
                    'Когда наступит этап «Оплата заказов», используйте /pay или кнопку в заказе.',
            );
            return;
        }

        await ctx.reply(
            'Нет закупок, по которым можно отправить оплату.\n' +
                'Возможно, всё уже оплачено или есть платёж на проверке — см. /payments',
        );
        return;
    }

    const keyboard = new InlineKeyboard();
    for (const p of payable) {
        const label = `${p.tag} — ${p.remaining.toLocaleString('ru-RU')} ₽`;
        keyboard.text(label.slice(0, 60), `pay:pick:${p.purchaseId}`).row();
    }

    await ctx.reply('Выберите закупку для оплаты:', { reply_markup: keyboard });
}

export async function cancelPaymentCommand(ctx: CustomContext) {
    if (ctx.session.paymentFlow) {
        delete ctx.session.paymentFlow;
        await ctx.reply('Отправка оплаты отменена.');
        return;
    }
    await ctx.reply('Нет активной отправки оплаты.');
}

export async function payCallbackQuery(ctx: CustomContext) {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith('pay:')) return;

    const userId = ctx.session.userId!;
    const service = new PaymentService();

    if (data.startsWith('pay:pick:')) {
        const purchaseId = Number(data.slice('pay:pick:'.length));
        if (!Number.isFinite(purchaseId)) {
            await ctx.answerCallbackQuery({ text: 'Некорректная закупка' });
            return;
        }

        if (!(await isPurchasePaymentOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await service.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            await ctx.editMessageText('Эта закупка больше недоступна для оплаты. Нажмите /pay снова.');
            return;
        }

        ctx.session.paymentFlow = {
            step: 'amount',
            purchaseId,
            purchaseTag: info.tag,
            remaining: info.remaining,
        };

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
        return;
    }

    if (data.startsWith('pay:all:')) {
        const purchaseId = Number(data.slice('pay:all:'.length));
        if (!(await isPurchasePaymentOpenById(purchaseId))) {
            await ctx.answerCallbackQuery({ text: 'Пока нельзя оплатить', show_alert: true });
            return;
        }

        const info = await service.getPurchasePaymentInfo(userId, purchaseId);
        if (!info || info.remaining <= 0 || info.hasPending) {
            await ctx.answerCallbackQuery({ text: 'Оплата недоступна' });
            return;
        }

        ctx.session.paymentFlow = {
            step: 'proof',
            purchaseId,
            purchaseTag: info.tag,
            remaining: info.remaining,
            amount: info.remaining,
        };

        await ctx.answerCallbackQuery();
        await ctx.reply(
            `Сумма: ${info.remaining.toLocaleString('ru-RU')} ₽\n\n` +
                `Пришлите фото или PDF чека об оплате.\n` +
                `Комментарий можно добавить в подписи к файлу.\n\n` +
                `/cancel — отменить`,
        );
    }
}

export async function paymentFlowTextHandler(ctx: CustomContext, next: NextFunction) {
    const flow = ctx.session.paymentFlow;
    if (!flow || !isPrivateChat(ctx)) {
        await next();
        return;
    }

    if (flow.step === 'proof') {
        const text = ctx.message?.text?.trim();
        if (text && !text.startsWith('/')) {
            await ctx.reply('Пришлите фото или PDF чека. Комментарий укажите в подписи к файлу.');
        }
        return;
    }

    if (flow.step !== 'amount') {
        await next();
        return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) {
        await next();
        return;
    }

    if (text.startsWith('/')) {
        await next();
        return;
    }

    const amount = parseAmount(text);
    if (amount === null || amount <= 0) {
        await ctx.reply('Введите корректную сумму, например: 1500');
        return;
    }

    if (amount > flow.remaining) {
        await ctx.reply(`Максимум ${flow.remaining.toLocaleString('ru-RU')} ₽`);
        return;
    }

    if (!(await isPurchasePaymentOpenById(flow.purchaseId))) {
        delete ctx.session.paymentFlow;
        await ctx.reply(PAYMENT_NOT_OPEN_MESSAGE);
        return;
    }

    flow.amount = amount;
    flow.step = 'proof';
    ctx.session.paymentFlow = flow;

    await ctx.reply(
        `Сумма: ${amount.toLocaleString('ru-RU')} ₽\n\n` +
            `Пришлите фото или PDF чека об оплате.\n` +
            `Комментарий можно добавить в подписи к файлу.\n\n` +
            `/cancel — отменить`,
    );
}

function messageHasPaymentFile(ctx: CustomContext): boolean {
    const message = ctx.message;
    if (!message) return false;
    return (
        ('photo' in message && Boolean(message.photo?.length)) ||
        ('document' in message && Boolean(message.document))
    );
}

export async function paymentProofHandler(ctx: CustomContext) {
    if (!isPrivateChat(ctx) || !messageHasPaymentFile(ctx)) {
        return;
    }

    const flow = ctx.session.paymentFlow;

    if (flow?.step === 'amount') {
        await ctx.reply('Сначала укажите сумму оплаты числом. Фото чека примем после этого.');
        return;
    }

    if (!flow || flow.step !== 'proof' || flow.amount == null) {
        return;
    }

    if (!(await isPurchasePaymentOpenById(flow.purchaseId))) {
        delete ctx.session.paymentFlow;
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

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(mimeType)) {
        await ctx.reply('Допустимы только изображения и PDF (до 5 МБ).');
        return;
    }

    const userComment = message.caption?.trim() || undefined;

    try {
        const proofData = await downloadTelegramFile(ctx.api, fileId, BOT_TOKEN);
        const service = new PaymentService();
        await service.submitPaymentWithProof({
            userId: ctx.session.userId!,
            purchaseId: flow.purchaseId,
            amount: flow.amount,
            userComment,
            proofData,
            proofMimeType: mimeType,
        });

        delete ctx.session.paymentFlow;

        await ctx.reply(
            `✅ Оплата ${flow.amount.toLocaleString('ru-RU')} ₽ по закупке «${flow.purchaseTag}» отправлена на проверку.\n` +
                `Статус: /payments`,
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Не удалось отправить оплату';
        await ctx.reply(`❌ ${msg}`);
    }
}

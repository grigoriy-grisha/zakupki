import { createLogger } from '@zakupki/logger';
import { isPurchasePaymentOpen, roundMoney, ValidationError } from '@zakupki/types';

import { computeOnlineFee, SBP_MIN_TOTAL } from '@/lib/online-payment-fee';

import type { PaymentRepository } from '../domain/payment.repository';
import type { PurchaseRepository } from '../domain/purchase.repository';
import type { UserRepository } from '../domain/user.repository';
import {
    getTbankClient,
    TBANK_CANCELABLE_STATUSES,
    TBANK_FAILED_STATUSES,
    TBANK_PAID_STATUSES,
    TBANK_TAXATIONS,
    TBANK_VATS,
    TbankApiError,
    type TbankClient,
    type TbankReceipt,
    type TbankTaxation,
    type TbankVat,
} from '../lib/tbank';
import {
    buildPaymentBreakdown,
    type PaymentBreakdown,
    type PaymentBreakdownItem,
} from '../lib/tbank/payment-breakdown';
import type { BotPaymentService } from './bot-payment.service';
import type { NotificationService } from './notification.service';
import type { PromoCodeService } from './promo-code.service';
import type { SettingsService } from './settings/settings.service';

const log = createLogger('online-payment');

export type OnlinePaymentMethod = 'TBANK_CARD' | 'TBANK_SBP';

/** Сколько живёт ссылка на оплату. */
const PAYMENT_TTL_MS = 30 * 60 * 1000;
/** Запас после истечения ссылки, прежде чем сверять статус с банком. */
const SWEEP_GRACE_MS = 5 * 60 * 1000;
/** Минимальная сумма для СБП у Т-Банка. */
/** Если банк сутки после истечения ссылки так и не ответил по платежу — закрываем его у себя. */
const STUCK_CLOSE_MS = 24 * 60 * 60 * 1000;
const METHOD_LABEL: Record<OnlinePaymentMethod, string> = {
    TBANK_CARD: 'картой',
    TBANK_SBP: 'по СБП',
};

type CreateOnlinePaymentParams = {
    userId: number;
    purchaseId: number;
    /** Сумма до промокода (как вводит клиент). */
    amount: number;
    method: OnlinePaymentMethod;
    promoCode?: string;
    receiptContact?: string;
    /** Куда вернуть клиента после оплаты (например, ссылка на бота). По умолчанию — заказы в магазине. */
    returnUrl?: string;
};

/** Очередь по ключу: задачи с одним ключом выполняются строго друг за другом (в пределах процесса). */
const keyLocks = new Map<string, Promise<unknown>>();
async function withKeyLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = keyLocks.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(task);
    keyLocks.set(key, run);
    try {
        return await run;
    } finally {
        if (keyLocks.get(key) === run) keyLocks.delete(key);
    }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Итог сверки оплат клиента с банком. */
export type SyncResult = { confirmed: number; rejected: number; open: number };

export type OnlinePaymentConfig = {
    enabled: boolean;
    cardFeePercent: number;
    sbpFeePercent: number;
    receiptEnabled: boolean;
};

export type CreatedOnlinePayment = {
    paymentId: number;
    paymentUrl: string;
    /** Сумма, которая гасит долг (после промокода). */
    amount: number;
    fee: number;
    /** Итого к списанию с клиента. */
    total: number;
    expiresAt: Date;
};

const toKopecks = (rub: number): number => Math.round(rub * 100);

/** Дата в формате Т-Банка `YYYY-MM-DDTHH:MM:SS+03:00` (московское время). */
export function formatTbankDate(date: Date): string {
    const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return msk.toISOString().replace(/\.\d{3}Z$/, '+03:00');
}

/** Контакт для чека — только email (чек уходит на почту). Невалидный адрес → null. */
export function normalizeReceiptContact(raw: string | null | undefined): { email: string } | null {
    const value = raw?.trim();
    if (!value || !EMAIL_RE.test(value)) return null;
    return { email: value.toLowerCase() };
}

/** Пометка к отклонённой оплате: с кодом отказа банка, если он его прислал («0» — не ошибка). */
export function failedPaymentNote(failure?: { code?: string; message?: string }): string {
    const code = failure?.code?.trim();
    if (!code || code === '0') return 'Оплата не прошла';
    const message = failure?.message?.trim();
    return `Оплата не прошла (код банка ${code}${message ? `: ${message}` : ''})`;
}

/**
 * Онлайн-оплата заказов через интернет-эквайринг Т-Банка.
 *
 * Жизненный цикл: AWAITING (ссылка выдана) → CONFIRMED (вебхук CONFIRMED) или REJECTED
 * (отказ / истекла ссылка / клиент начал новую оплату). Сумма AWAITING резервируется в остатке,
 * чтобы нельзя было оплатить один долг дважды с разных устройств.
 */
export class OnlinePaymentService {
    constructor(
        private readonly repo: PaymentRepository,
        private readonly users: UserRepository,
        private readonly purchases: PurchaseRepository,
        private readonly paymentInfo: BotPaymentService,
        private readonly promoCode: PromoCodeService,
        private readonly settings: SettingsService,
        private readonly notification: NotificationService,
        private readonly clientFactory: () => TbankClient | null = getTbankClient,
    ) {}

    async getConfig(): Promise<OnlinePaymentConfig> {
        const values = await this.settings.getMany([
            'online_payment_card_fee_percent',
            'online_payment_sbp_fee_percent',
            'receipt_enabled',
        ]);
        return {
            enabled: this.clientFactory() != null && Boolean(process.env.APP_PUBLIC_URL?.trim()),
            cardFeePercent: values.online_payment_card_fee_percent,
            sbpFeePercent: values.online_payment_sbp_fee_percent,
            receiptEnabled: values.receipt_enabled,
        };
    }

    /** Сохранённая почта для чека (невалидную не подставляем — клиент введёт заново). */
    async getSavedReceiptContact(userId: number): Promise<string | null> {
        const user = await this.users.findReceiptContact(userId);
        return normalizeReceiptContact(user?.email)?.email ?? null;
    }

    async create(params: CreateOnlinePaymentParams): Promise<CreatedOnlinePayment> {
        // Двойное нажатие в боте или две вкладки: создаём платежи клиента по закупке строго по очереди,
        // иначе оба запроса видят один и тот же остаток и клиент платит дважды.
        return withKeyLock(`${params.userId}:${params.purchaseId}`, () => this.createLocked(params));
    }

    private async createLocked(params: CreateOnlinePaymentParams): Promise<CreatedOnlinePayment> {
        const client = this.requireClient();
        const publicUrl = this.requirePublicUrl();
        const config = await this.getConfig();

        const purchase = await this.purchases.findPaymentInfo(params.purchaseId);
        // Удалённая закупка скрыта из магазина и бота — оплату по ней тоже не принимаем.
        if (!purchase || purchase.deletedAt || !isPurchasePaymentOpen(purchase.fulfillmentStatus)) {
            throw new ValidationError('Оплата по этой закупке сейчас не принимается');
        }

        let receiptContact: { email: string } | null = null;
        if (config.receiptEnabled) {
            const raw = params.receiptContact ?? (await this.getSavedReceiptContact(params.userId));
            receiptContact = normalizeReceiptContact(raw);
            if (!receiptContact) {
                throw new ValidationError('Укажите email для электронного чека');
            }
        }

        // Открытые ссылки клиента по закупке держат резерв. Если новая сумма помещается в свободный
        // остаток (клиент доплачивает часть) — открытую ссылку не трогаем. Иначе закрываем старые
        // ссылки, чтобы освободить резерв, и считаем остаток заново.
        let info = await this.paymentInfo.getPurchasePaymentInfo(params.userId, params.purchaseId);
        if (!info) throw new ValidationError('Закупка не найдена');
        if (roundMoney(params.amount) > roundMoney(info.available) && info.awaiting > 0) {
            await this.releaseAwaiting(params.userId, params.purchaseId, client);
            info = await this.paymentInfo.getPurchasePaymentInfo(params.userId, params.purchaseId);
            if (!info) throw new ValidationError('Закупка не найдена');
        }
        const available = roundMoney(info.available);
        if (params.amount <= 0 || roundMoney(params.amount) > available) {
            throw new ValidationError(`Сумма должна быть от 1 до ${available.toLocaleString('ru-RU')} ₽`);
        }

        const promo = await this.promoCode.resolveForSubmit({
            userId: params.userId,
            purchaseId: params.purchaseId,
            code: params.promoCode,
            amount: params.amount,
            due: info.due,
        });
        const discount = promo?.discountAmount ?? 0;
        const net = roundMoney(params.amount - discount);
        const feePercent = params.method === 'TBANK_SBP' ? config.sbpFeePercent : config.cardFeePercent;
        const fee = computeOnlineFee(net, feePercent);
        const total = roundMoney(net + fee);

        if (params.method === 'TBANK_SBP' && total < SBP_MIN_TOTAL) {
            throw new ValidationError(`Минимальная сумма для оплаты по СБП — ${SBP_MIN_TOTAL} ₽`);
        }
        if (total < 1) {
            throw new ValidationError('Сумма к оплате должна быть не меньше 1 ₽');
        }

        if (receiptContact) {
            await this.saveReceiptContact(params.userId, receiptContact);
        }

        const expiresAt = new Date(Date.now() + PAYMENT_TTL_MS);
        const providerOrderId = `zk${params.purchaseId}-${params.userId}-${Date.now().toString(36)}`;
        const created = await this.repo.submitPayment({
            userId: params.userId,
            purchaseId: params.purchaseId,
            amount: net,
            promoCodeId: promo?.promoCodeId,
            discountAmount: discount || undefined,
            online: { method: params.method, feeAmount: fee, providerOrderId, expiresAt },
        });
        if (!created) throw new ValidationError('Не удалось создать платёж');

        const breakdown = buildPaymentBreakdown({
            tag: purchase.tag,
            lines: await this.paymentInfo.getPaymentBreakdownLines(params.userId, params.purchaseId),
            due: info.due,
            amount: params.amount,
            discount,
            fee,
        });
        const resultUrl = `${publicUrl}/shop/orders?purchaseId=${params.purchaseId}`;

        try {
            const init = await client.init({
                Amount: toKopecks(total),
                OrderId: providerOrderId,
                Description: breakdown.description,
                NotificationURL: `${publicUrl}/api/payments/tbank/notification`,
                SuccessURL: params.returnUrl ?? `${resultUrl}&payment=success`,
                FailURL: params.returnUrl ?? `${resultUrl}&payment=fail`,
                RedirectDueDate: formatTbankDate(expiresAt),
                PayType: 'O',
                DATA: {
                    paymentId: String(created.id),
                    purchaseId: String(params.purchaseId),
                    // Email в DATA банк подставляет в поле «Мне нужен чек» на своей форме,
                    // чтобы клиент не вводил его второй раз (сам чек уходит через Receipt.Email).
                    ...(receiptContact ? { Email: receiptContact.email } : {}),
                },
                Receipt: receiptContact ? await this.buildReceipt({ breakdown, contact: receiptContact }) : undefined,
            });
            if (!init.PaymentId || !init.PaymentURL) {
                throw new TbankApiError('Банк не вернул ссылку на оплату', init.ErrorCode ?? 'unknown');
            }

            const providerPaymentId = String(init.PaymentId);
            let paymentUrl = init.PaymentURL;
            if (params.method === 'TBANK_SBP') {
                try {
                    const qr = await client.getSbpPayload(providerPaymentId);
                    if (qr.Data) paymentUrl = qr.Data;
                } catch (err) {
                    // СБП может быть не подключена на терминале — тогда клиент выберет способ на форме банка.
                    log.warn({ paymentId: created.id, err }, 'GetQr failed, falling back to payment form');
                }
            }

            await this.repo.setProviderData(created.id, {
                providerPaymentId,
                paymentUrl,
                providerStatus: init.Status ?? 'NEW',
            });

            log.info(
                { paymentId: created.id, providerPaymentId, method: params.method, total },
                'online payment created',
            );
            return { paymentId: created.id, paymentUrl, amount: net, fee, total, expiresAt };
        } catch (err) {
            await this.repo
                .transition(created.id, 'REJECTED', { adminNote: 'Не удалось создать платёж в банке' }, ['AWAITING'])
                .catch(() => undefined);
            if (err instanceof TbankApiError) {
                log.error({ paymentId: created.id, code: err.errorCode, details: err.details }, 'tbank init failed');
                throw new ValidationError(`Платёжный сервис отклонил запрос: ${err.message}`);
            }
            log.error({ paymentId: created.id, err }, 'tbank init failed');
            throw new ValidationError('Платёжный сервис недоступен, попробуйте позже');
        }
    }

    /**
     * Возврат денег клиенту по оплаченному онлайн-платежу (вся сумма или часть).
     * Деньги уходят обратно на карту через Т-Банк, касса пробивает чек возврата,
     * а у нас появляется строка «Возврат» с минусом — долг и переплата пересчитываются сами.
     * Комиссия банка не возвращается.
     */
    async refund(params: { paymentId: number; amount: number; reason?: string }): Promise<{ refundId: number }> {
        // Двойной клик или два админа: без замка обе заявки прошли бы проверку остатка.
        return withKeyLock(`refund:${params.paymentId}`, () => this.refundLocked(params));
    }

    private async refundLocked(params: {
        paymentId: number;
        amount: number;
        reason?: string;
    }): Promise<{ refundId: number }> {
        const client = this.requireClient();
        const payment = await this.repo.getById(params.paymentId);
        if (
            !payment ||
            payment.parentId != null ||
            payment.refundOfId != null ||
            payment.method === 'MANUAL' ||
            payment.status !== 'CONFIRMED' ||
            !payment.providerPaymentId
        ) {
            throw new ValidationError('По этой оплате нельзя сделать возврат');
        }

        const refunded = await this.repo.getRefundedTotal(payment.id);
        const maxRefund = roundMoney(Number(payment.amount) - refunded);
        const amount = roundMoney(params.amount);
        if (maxRefund <= 0) {
            throw new ValidationError('По этой оплате уже всё вернули');
        }
        if (amount <= 0 || amount > maxRefund) {
            throw new ValidationError(`Вернуть можно от 1 до ${maxRefund.toLocaleString('ru-RU')} ₽`);
        }

        const tag = (await this.purchases.findPaymentInfo(payment.purchaseId))?.tag ?? '';

        let receipt: TbankReceipt | undefined;
        const config = await this.getConfig();
        if (config.receiptEnabled) {
            const contact = normalizeReceiptContact(await this.getSavedReceiptContact(payment.userId));
            if (contact) {
                receipt = await this.buildReceipt({ refund: { tag, amount }, contact });
            } else {
                log.warn({ paymentId: payment.id }, 'refund without receipt: no saved contact');
            }
        }

        let providerStatus: string | undefined;
        try {
            const result = await client.refund(payment.providerPaymentId, toKopecks(amount), receipt);
            providerStatus = result.Status;
        } catch (err) {
            if (err instanceof TbankApiError) {
                log.error({ paymentId: payment.id, code: err.errorCode, details: err.details }, 'tbank refund failed');
                throw new ValidationError(`Банк не принял возврат: ${err.message}`);
            }
            log.error({ paymentId: payment.id, err }, 'tbank refund failed');
            throw new ValidationError('Банк сейчас недоступен, попробуйте позже');
        }

        const reason = params.reason?.trim();
        const refundData = {
            original: payment,
            amount,
            adminNote: reason ? `Возврат: ${reason}` : 'Возврат на карту',
            providerStatus,
        };
        let created: Awaited<ReturnType<PaymentRepository['createRefund']>>;
        try {
            created = await this.repo.createRefund(refundData);
        } catch (err) {
            // Деньги банк уже вернул — запись терять нельзя: пробуем ещё раз и громко пишем в лог.
            log.error({ paymentId: payment.id, amount, err }, 'refund sent to bank but not saved, retrying');
            try {
                created = await this.repo.createRefund(refundData);
            } catch (retryErr) {
                log.fatal(
                    { paymentId: payment.id, amount, providerStatus, err: retryErr },
                    'REFUND NOT SAVED: bank refunded money, record it manually',
                );
                throw new ValidationError(
                    'Банк вернул деньги, но сайт не смог записать возврат. Не повторяйте возврат — сообщите разработчику.',
                );
            }
        }
        log.info({ paymentId: payment.id, refundId: created.id, amount, providerStatus }, 'online payment refunded');

        try {
            await this.notification.notify({
                userId: payment.userId,
                type: 'PAYMENT_REFUNDED',
                payload: { purchaseId: payment.purchaseId, purchaseTag: tag, amount, adminNote: reason || null },
            });
        } catch (err) {
            log.warn({ paymentId: payment.id, err }, 'failed to notify about refund');
        }
        return { refundId: created.id };
    }

    /** Клиент отменяет свою неоплаченную онлайн-оплату. */
    async cancelByUser(userId: number, paymentId: number): Promise<void> {
        const payment = await this.repo.getById(paymentId);
        if (!payment || payment.userId !== userId || payment.status !== 'AWAITING') {
            throw new ValidationError('Эту оплату нельзя отменить');
        }
        const client = this.requireClient();
        const outcome = await withKeyLock(`${payment.userId}:${payment.purchaseId}`, () =>
            this.reconcile(payment, client, { cancelIfOpen: true, reason: 'Отменено участником' }),
        );
        if (outcome === 'processing') {
            throw new ValidationError('Банк ещё обрабатывает эту оплату. Попробуйте через минуту.');
        }
        if (outcome === 'confirmed') {
            throw new ValidationError('Эта оплата уже прошла');
        }
    }

    /**
     * Обработка уведомления Т-Банка. Возвращает false, если подпись неверна.
     * Идемпотентна: повторные уведомления о том же статусе ничего не меняют.
     */
    async handleNotification(body: Record<string, unknown>): Promise<boolean> {
        const client = this.requireClient();
        if (!client.verifyNotification(body)) {
            log.warn({ orderId: body.OrderId, status: body.Status }, 'tbank notification: bad token');
            return false;
        }

        const orderId = String(body.OrderId ?? '');
        const status = String(body.Status ?? '');
        // Код отказа банка: без него не понять, почему платёж не прошёл (карта, 3-D Secure, лимиты).
        const failure = {
            code: body.ErrorCode != null ? String(body.ErrorCode) : undefined,
            message: typeof body.Message === 'string' ? body.Message : undefined,
        };
        log.info({ orderId, status, errorCode: failure.code, message: failure.message }, 'tbank notification');
        const payment = await this.repo.findByProviderOrderId(orderId);
        if (!payment) {
            log.warn({ orderId, status }, 'tbank notification: unknown order');
            return true;
        }

        const expectedKopecks = toKopecks(Number(payment.amount) + Number(payment.feeAmount ?? 0));
        if (TBANK_PAID_STATUSES.has(status) && Number(body.Amount) !== expectedKopecks) {
            // Не засчитываем сумму, которую не ждали: пусть админ разберётся вручную.
            log.error(
                { paymentId: payment.id, amount: body.Amount, expectedKopecks },
                'tbank notification: amount mismatch',
            );
            await this.repo.setProviderData(payment.id, {
                providerStatus: status,
                adminNote: `Банк сообщил другую сумму: ${Number(body.Amount) / 100} ₽ — проверьте вручную`,
            });
            return true;
        }

        await this.applyProviderStatus(payment, status, failure);
        return true;
    }

    /**
     * Сверка незавершённых оплат клиента с банком — когда он вернулся с формы или открыл заказы.
     * Страхует от недошедшего вебхука. Открытые платежи не отменяем: клиент может ещё платить.
     * Под тем же замком, что и создание оплаты: иначе сверка могла бы закрыть платёж,
     * для которого банк ещё не успел вернуть ссылку.
     */
    async syncForUser(userId: number): Promise<SyncResult> {
        const result: SyncResult = { confirmed: 0, rejected: 0, open: 0 };
        const client = this.clientFactory();
        if (!client) return result;
        const awaiting = await this.repo.findAwaitingByUser(userId);
        for (const payment of awaiting) {
            try {
                const outcome = await withKeyLock(`${payment.userId}:${payment.purchaseId}`, () =>
                    this.reconcile(payment, client, { cancelIfOpen: false, reason: '' }),
                );
                if (outcome === 'confirmed') result.confirmed += 1;
                else if (outcome === 'rejected') result.rejected += 1;
                else result.open += 1;
            } catch (err) {
                log.warn({ paymentId: payment.id, err }, 'sync: reconcile failed');
            }
        }
        return result;
    }

    /** Есть ли у клиента созданные, но не оплаченные ссылки. */
    async hasAwaiting(userId: number): Promise<boolean> {
        const awaiting = await this.repo.findAwaitingByUser(userId);
        return awaiting.length > 0;
    }

    /** Сверка зависших онлайн-платежей (если вебхук не дошёл или клиент бросил оплату). */
    async sweepStale(): Promise<number> {
        const client = this.clientFactory();
        if (!client) return 0;
        const stale = await this.repo.findStaleAwaiting(new Date(Date.now() - SWEEP_GRACE_MS));
        let settled = 0;
        for (const payment of stale) {
            try {
                const outcome = await withKeyLock(`${payment.userId}:${payment.purchaseId}`, () =>
                    this.reconcile(payment, client, { cancelIfOpen: true, reason: 'Время на оплату истекло' }),
                );
                if (outcome !== 'processing') settled += 1;
            } catch (err) {
                log.warn({ paymentId: payment.id, err }, 'sweep: reconcile failed');
                // Банк сутками не отвечает по платежу (неизвестный PaymentId и т.п.) — закрываем у себя,
                // чтобы такие строки не забили выборку и не держали резерв. Поздний вебхук всё равно
                // переведёт REJECTED → CONFIRMED.
                if (payment.expiresAt && Date.now() - payment.expiresAt.getTime() > STUCK_CLOSE_MS) {
                    await this.repo.transition(payment.id, 'REJECTED', { adminNote: 'Банк не подтвердил оплату' }, [
                        'AWAITING',
                    ]);
                }
            }
        }
        return settled;
    }

    private async releaseAwaiting(userId: number, purchaseId: number, client: TbankClient): Promise<void> {
        const awaiting = await this.repo.findAwaiting(userId, purchaseId);
        for (const payment of awaiting) {
            const outcome = await this.reconcile(payment, client, {
                cancelIfOpen: true,
                reason: 'Заменена новой оплатой',
            });
            if (outcome === 'processing') {
                throw new ValidationError(
                    'Предыдущая оплата ещё обрабатывается банком. Подождите пару минут и обновите страницу.',
                );
            }
        }
    }

    /**
     * Сверяет платёж со статусом в банке и закрывает его, если это безопасно.
     * Отменяем у банка только то, что клиент ещё не начал оплачивать (NEW / FORM_SHOWED).
     */
    private async reconcile(
        payment: { id: number; status: string; providerPaymentId: string | null },
        client: TbankClient,
        opts: { cancelIfOpen: boolean; reason: string },
    ): Promise<'confirmed' | 'rejected' | 'processing'> {
        if (!payment.providerPaymentId) {
            // Init не успел вернуть PaymentId — в банке платежа нет.
            await this.repo.transition(payment.id, 'REJECTED', { adminNote: opts.reason }, ['AWAITING']);
            return 'rejected';
        }

        const state = await client.getState(payment.providerPaymentId);
        const status = state.Status ?? '';
        if (TBANK_PAID_STATUSES.has(status)) {
            await this.applyProviderStatus(payment, status);
            return 'confirmed';
        }
        if (TBANK_FAILED_STATUSES.has(status)) {
            await this.applyProviderStatus(payment, status);
            return 'rejected';
        }
        if (opts.cancelIfOpen && TBANK_CANCELABLE_STATUSES.has(status)) {
            let providerStatus = 'CANCELED';
            try {
                await client.cancel(payment.providerPaymentId);
            } catch (err) {
                if (!(err instanceof TbankApiError)) throw err;
                // Банк не всегда даёт отменить открытый платёж (например, после выдачи QR по СБП).
                // Ссылка всё равно истечёт по RedirectDueDate, а если клиент успеет оплатить —
                // вебхук переведёт платёж REJECTED → CONFIRMED, поэтому деньги не потеряются.
                log.warn(
                    { paymentId: payment.id, errorCode: err.errorCode, status },
                    'tbank cancel refused, closing payment locally',
                );
                providerStatus = status;
            }
            await this.repo.transition(payment.id, 'REJECTED', { adminNote: opts.reason, providerStatus }, [
                'AWAITING',
            ]);
            return 'rejected';
        }
        await this.repo.setProviderData(payment.id, { providerStatus: status });
        return 'processing';
    }

    private async applyProviderStatus(
        payment: { id: number; status: string },
        status: string,
        failure?: { code?: string; message?: string },
    ): Promise<void> {
        if (TBANK_PAID_STATUSES.has(status)) {
            const updated = await this.repo.transition(
                payment.id,
                'CONFIRMED',
                { adminNote: 'Оплачено онлайн (Т-Банк)', providerStatus: status, paidAt: new Date() },
                ['AWAITING', 'REJECTED'],
            );
            if (updated) {
                if (payment.status === 'REJECTED') {
                    log.warn({ paymentId: payment.id }, 'payment confirmed by bank after it was closed locally');
                }
                await this.notifyConfirmed(payment.id);
            }
            return;
        }
        if (TBANK_FAILED_STATUSES.has(status)) {
            await this.repo.transition(
                payment.id,
                'REJECTED',
                { adminNote: failedPaymentNote(failure), providerStatus: status },
                ['AWAITING'],
            );
            return;
        }
        // Возвраты (уведомление приходит раньше, чем мы записали строку «Возврат») и
        // промежуточные статусы (AUTHORIZED, FORM_SHOWED…) просто запоминаем.
        await this.repo.setProviderData(payment.id, { providerStatus: status });
    }

    private async notifyConfirmed(id: number): Promise<void> {
        try {
            const payment = await this.repo.findWithPurchase(id);
            if (!payment) return;
            const method = payment.method;
            await this.notification.notify({
                userId: payment.userId,
                type: 'PAYMENT_CONFIRMED',
                payload: {
                    purchaseId: payment.purchaseId,
                    purchaseTag: payment.purchase.tag,
                    amount: Number(payment.amount),
                    adminNote: method && method !== 'MANUAL' ? `Оплачено онлайн ${METHOD_LABEL[method]}` : null,
                },
            });
        } catch (err) {
            log.warn({ paymentId: id, err }, 'failed to notify about online payment');
        }
    }

    private async buildReceipt(params: {
        /** Расшифровка платежа: товары, доставка, оргсбор, комиссия. */
        breakdown?: PaymentBreakdown;
        /** Чек возврата: одна позиция на возвращаемую сумму. */
        refund?: { tag: string; amount: number };
        contact: { email?: string; phone?: string };
    }): Promise<TbankReceipt> {
        const values = await this.settings.getMany(['receipt_taxation', 'receipt_vat']);
        const taxation = (TBANK_TAXATIONS as readonly string[]).includes(values.receipt_taxation)
            ? (values.receipt_taxation as TbankTaxation)
            : 'usn_income_outcome';
        const vat = (TBANK_VATS as readonly string[]).includes(values.receipt_vat)
            ? (values.receipt_vat as TbankVat)
            : 'none';

        const sourceItems: PaymentBreakdownItem[] = params.refund
            ? [{ kind: 'goods', name: `Оплата заказа по закупке ${params.refund.tag}`, amount: params.refund.amount }]
            : (params.breakdown?.items ?? []);
        // Частичная оплата заказа — «частичная предоплата», заказ целиком — «предоплата 100%».
        const paymentMethod = params.breakdown?.partial ? 'prepayment' : 'full_prepayment';
        const items: TbankReceipt['Items'] = sourceItems.map((item) => ({
            Name: item.name.slice(0, 128),
            Price: toKopecks(item.amount),
            Quantity: 1,
            Amount: toKopecks(item.amount),
            Tax: vat,
            PaymentMethod: paymentMethod,
            PaymentObject: item.kind === 'goods' ? 'commodity' : 'service',
            MeasurementUnit: 'шт',
        }));
        return {
            FfdVersion: '1.2',
            Taxation: taxation,
            Email: params.contact.email,
            Items: items,
        };
    }

    private async saveReceiptContact(userId: number, contact: { email: string }): Promise<void> {
        await this.users.updateReceiptContact(userId, { email: contact.email }).catch((err) => {
            log.warn({ userId, err }, 'failed to save receipt contact');
        });
    }

    private requireClient(): TbankClient {
        const client = this.clientFactory();
        if (!client) throw new ValidationError('Онлайн-оплата временно недоступна');
        return client;
    }

    private requirePublicUrl(): string {
        const url = process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, '');
        if (!url) throw new ValidationError('Онлайн-оплата не настроена (нет APP_PUBLIC_URL)');
        return url;
    }
}

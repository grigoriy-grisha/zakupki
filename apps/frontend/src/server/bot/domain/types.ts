import type { PrismaClient } from '@zakupki/database';
import type { Context, SessionFlavor } from 'grammy';

export type PaymentFlowStep = 'amount' | 'promo' | 'proof';

/** Result of a successfully validated promo code, carried through to proof step. */
export interface PromoCodeApplied {
    id: number;
    code: string;
    discount: number;
    finalAmount: number;
}

export interface PaymentFlow {
    step: PaymentFlowStep;
    purchaseId: number;
    purchaseTag: string;
    /** Доступно к оплате сейчас: долг минус подтверждённые и ожидающие оплаты. */
    available: number;
    amount?: number;
    promoCode?: PromoCodeApplied;
}

export interface SessionData {
    userId?: number;
    telegramId?: number;
    profileRefreshedAt?: number;
    paymentFlow?: PaymentFlow;
}

export type CustomContext = Context &
    SessionFlavor<SessionData> & {
        db: PrismaClient;
    };

export interface CreateBotOptions {
    token: string;
    proxyUrl?: string;
}

export type ChannelPostPhoto = {
    data: Buffer;
    mimeType: string;
};

export type ProductPhotoInput = {
    objectKey: string;
    mimeType: string;
};

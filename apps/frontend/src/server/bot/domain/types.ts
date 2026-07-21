import type { Context, SessionFlavor } from 'grammy';
import type { PrismaClient } from '@zakupki/database';

export type PaymentFlowStep = 'amount' | 'proof';

export interface PaymentFlow {
    step: PaymentFlowStep;
    purchaseId: number;
    purchaseTag: string;
    remaining: number;
    amount?: number;
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

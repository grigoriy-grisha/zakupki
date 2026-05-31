import type { Context, SessionFlavor } from 'grammy';
import type { PrismaClient } from '@zakupki/database';

export interface SessionData {
    userId?: number;
    telegramId?: number;
    profileRefreshedAt?: number;
}

export type CustomContext = Context &
    SessionFlavor<SessionData> & {
        db: PrismaClient;
    };

export interface CreateBotOptions {
    token: string;
    proxyUrl?: string;
}

export interface PostProduct {
    name: string;
    description: string | null;
    pricePerUnit: unknown;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unit: { shortName: string } | null;
}

export type ChannelPostPhoto = {
    data: Buffer;
    mimeType: string;
};

export type ProductPhotoInput = {
    objectKey: string;
    mimeType: string;
};

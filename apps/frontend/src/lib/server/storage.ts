import fs from 'node:fs/promises';
import path from 'node:path';

import { dbClient } from '@zakupki/database';
// @ts-ignore
import EasyYandexS3 from 'easy-yandex-s3';

import {
    getLocalUploadDir,
    getPublicUrlPrefix,
    isS3Configured,
    resolveLocalFilePath,
} from './storage-config';

export interface IStorage {
    upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number>;
    uploadPaymentProof(userId: number, purchaseId: number, data: Uint8Array, mimeType: string): Promise<string>;
    delete(id: number): Promise<void>;
    getPublicUrl(objectKey: string): string;
}

function buildObjectKey(prefix: string, ext: string): string {
    return `${prefix}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
}

export class LocalFileStorage implements IStorage {
    private async writeFile(objectKey: string, data: Uint8Array): Promise<void> {
        const filePath = resolveLocalFilePath(objectKey);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, data);
    }

    async upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = buildObjectKey(`products/${productId}`, ext);

        await this.writeFile(objectKey, data);

        const photo = await dbClient.productPhoto.create({
            data: { productId, objectKey, mimeType, sortOrder },
        });
        return photo.id;
    }

    async uploadPaymentProof(
        userId: number,
        purchaseId: number,
        data: Uint8Array,
        mimeType: string,
    ): Promise<string> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = buildObjectKey(`proofs/${userId}/${purchaseId}`, ext);

        await this.writeFile(objectKey, data);
        return objectKey;
    }

    async delete(id: number): Promise<void> {
        const photo = await dbClient.productPhoto.findUnique({ where: { id } });
        if (!photo) return;

        try {
            await fs.unlink(resolveLocalFilePath(photo.objectKey));
        } catch (err) {
            console.error('Failed to remove local file', err);
        }

        await dbClient.productPhoto.delete({ where: { id } });
    }

    getPublicUrl(objectKey: string): string {
        return objectKey;
    }
}

const s3 = new EasyYandexS3({
    auth: {
        accessKeyId: process.env.YANDEX_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.YANDEX_SECRET_ACCESS_KEY || '',
    },
    Bucket: process.env.YANDEX_BUCKET_NAME || '',
    debug: false,
});

export class YandexS3Storage implements IStorage {
    async upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = buildObjectKey(`products/${productId}`, ext);

        const uploadResult = await s3.Upload(
            {
                buffer: Buffer.from(data),
                name: objectKey,
            },
            '/',
        );

        if (!uploadResult) {
            throw new Error('Failed to upload to Yandex S3');
        }

        const photo = await dbClient.productPhoto.create({
            data: { productId, objectKey, mimeType, sortOrder },
        });
        return photo.id;
    }

    async uploadPaymentProof(
        userId: number,
        purchaseId: number,
        data: Uint8Array,
        mimeType: string,
    ): Promise<string> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = buildObjectKey(`proofs/${userId}/${purchaseId}`, ext);

        const uploadResult = await s3.Upload(
            {
                buffer: Buffer.from(data),
                name: objectKey,
            },
            '/',
        );

        if (!uploadResult) {
            throw new Error('Failed to upload to Yandex S3');
        }

        return objectKey;
    }

    async delete(id: number): Promise<void> {
        const photo = await dbClient.productPhoto.findUnique({ where: { id } });
        if (!photo) return;

        try {
            await s3.Remove(photo.objectKey);
        } catch (err) {
            console.error('Failed to remove S3 object', err);
        }

        await dbClient.productPhoto.delete({ where: { id } });
    }

    getPublicUrl(objectKey: string): string {
        return `${getPublicUrlPrefix()}/${objectKey}`;
    }
}

function createStorage(): IStorage {
    if (isS3Configured()) {
        return new YandexS3Storage();
    }

    console.warn('[storage] Yandex S3 is not configured — using local filesystem storage');
    return new LocalFileStorage();
}

export const storage: IStorage = createStorage();

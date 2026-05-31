import { dbClient } from '@zakupki/database';
// @ts-ignore
import EasyYandexS3 from 'easy-yandex-s3';

export interface IStorage {
    upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number>;
    uploadPaymentProof(userId: number, purchaseId: number, data: Uint8Array, mimeType: string): Promise<string>;
    delete(id: number): Promise<void>;
    getPublicUrl(objectKey: string): string;
}

const s3 = new EasyYandexS3({
    auth: {
        accessKeyId: process.env.YANDEX_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.YANDEX_SECRET_ACCESS_KEY || '',
    },
    Bucket: process.env.YANDEX_BUCKET_NAME || '',
    debug: false,
});

const PUBLIC_URL_PREFIX = process.env.YANDEX_PUBLIC_URL_PREFIX || `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET_NAME}`;

export class YandexS3Storage implements IStorage {
    async upload(productId: number, data: Uint8Array, mimeType: string, sortOrder: number): Promise<number> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = `products/${productId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const uploadResult = await s3.Upload({
            buffer: Buffer.from(data),
            name: objectKey
        }, '/');

        if (!uploadResult) {
            throw new Error('Failed to upload to Yandex S3');
        }

        const photo = await dbClient.productPhoto.create({
            data: { productId, objectKey, mimeType, sortOrder },
        });
        return photo.id;
    }

    async uploadPaymentProof(userId: number, purchaseId: number, data: Uint8Array, mimeType: string): Promise<string> {
        const ext = mimeType.split('/')[1] || 'jpeg';
        const objectKey = `proofs/${userId}/${purchaseId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

        await s3.Upload({
            buffer: Buffer.from(data),
            name: objectKey
        }, '/');

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
        return `${PUBLIC_URL_PREFIX}/${objectKey}`;
    }
}

export const storage: IStorage = new YandexS3Storage();

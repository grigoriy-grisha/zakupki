import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

import { isS3Configured, resolveLocalFilePath } from './config';

const require = createRequire(import.meta.url);
const EasyYandexS3 = require('easy-yandex-s3').default as new (params: {
    auth: { accessKeyId: string; secretAccessKey: string };
    Bucket: string;
    debug?: boolean;
}) => {
    Upload(payload: { buffer: Buffer; name: string }, route?: string): Promise<unknown>;
};

let s3Client: InstanceType<typeof EasyYandexS3> | null = null;

function getS3Client() {
    if (!s3Client) {
        s3Client = new EasyYandexS3({
            auth: {
                accessKeyId: process.env.YANDEX_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.YANDEX_SECRET_ACCESS_KEY || '',
            },
            Bucket: process.env.YANDEX_BUCKET_NAME || '',
            debug: false,
        });
    }
    return s3Client;
}

function buildProofObjectKey(userId: number, purchaseId: number, mimeType: string): string {
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return `proofs/${userId}/${purchaseId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
}

async function writeLocalProof(objectKey: string, data: Uint8Array): Promise<void> {
    const filePath = resolveLocalFilePath(objectKey);
    await fs.mkdir(filePath.substring(0, filePath.lastIndexOf('/')), { recursive: true });
    await fs.writeFile(filePath, data);
}

export async function uploadPaymentProof(
    userId: number,
    purchaseId: number,
    data: Uint8Array,
    mimeType: string,
): Promise<string> {
    const objectKey = buildProofObjectKey(userId, purchaseId, mimeType);

    if (isS3Configured()) {
        const uploadResult = await getS3Client().Upload({ buffer: Buffer.from(data), name: objectKey }, '/');
        if (!uploadResult) {
            throw new Error('Failed to upload payment proof to S3');
        }
        return objectKey;
    }

    await writeLocalProof(objectKey, data);
    return objectKey;
}

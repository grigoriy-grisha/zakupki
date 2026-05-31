import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

import { isS3Configured, resolveLocalFilePath } from './config.js';

const require = createRequire(import.meta.url);
const EasyYandexS3 = require('easy-yandex-s3').default as new (params: {
    auth: { accessKeyId: string; secretAccessKey: string };
    Bucket: string;
    debug?: boolean;
}) => {
    Download(routeFullPath: string): Promise<
        | {
              data?: {
                  Body?: Buffer | Uint8Array | string;
              };
          }
        | false
    >;
};

type S3DownloadResult = {
    data?: {
        Body?: Buffer | Uint8Array | string;
    };
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

function toBuffer(body: Buffer | Uint8Array | string): Buffer {
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body);
    return Buffer.from(body);
}

export async function loadProductPhoto(objectKey: string): Promise<Buffer | null> {
    const key = objectKey.trim();
    if (!key) return null;

    if (isS3Configured()) {
        try {
            const result = (await getS3Client().Download(key)) as S3DownloadResult | false;
            const body = result && typeof result === 'object' ? result.data?.Body : undefined;
            return body ? toBuffer(body) : null;
        } catch (err) {
            console.warn(`[storage] S3 download failed for ${key}:`, err);
            return null;
        }
    }

    try {
        return await fs.readFile(resolveLocalFilePath(key));
    } catch (err) {
        console.warn(`[storage] Local photo read failed for ${key}:`, err);
        return null;
    }
}

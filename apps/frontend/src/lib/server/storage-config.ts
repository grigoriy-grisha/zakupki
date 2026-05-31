import path from 'node:path';

export function isS3Configured(): boolean {
    return Boolean(
        process.env.YANDEX_ACCESS_KEY_ID &&
            process.env.YANDEX_SECRET_ACCESS_KEY &&
            process.env.YANDEX_BUCKET_NAME,
    );
}

export function getLocalUploadDir(): string {
    return process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

export function getPublicUrlPrefix(): string {
    return (
        process.env.YANDEX_PUBLIC_URL_PREFIX ||
        `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET_NAME}`
    );
}

export function resolveLocalFilePath(objectKey: string): string {
    return path.join(getLocalUploadDir(), objectKey);
}

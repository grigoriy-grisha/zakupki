import type { Api } from 'grammy';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export async function downloadTelegramFile(api: Api, fileId: string, botToken: string): Promise<Buffer> {
    const file = await api.getFile(fileId);
    if (!file.file_path) {
        throw new Error('Не удалось получить файл из Telegram');
    }

    const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Не удалось скачать файл');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PROOF_BYTES) {
        throw new Error('Файл слишком большой (максимум 5 МБ)');
    }

    return buffer;
}

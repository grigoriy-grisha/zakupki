import { get as httpsGet } from 'node:https';
import type { Api } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function downloadFileBuffer(url: string, agent?: HttpsProxyAgent<string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const request = httpsGet(url, { agent }, (response) => {
            const status = response.statusCode ?? 0;
            if (status < 200 || status >= 300) {
                response.resume();
                reject(new Error('Не удалось скачать файл'));
                return;
            }
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        request.on('error', reject);
    });
}

export async function downloadTelegramFile(
    api: Api,
    fileId: string,
    botToken: string,
    proxyUrl?: string | null,
): Promise<Buffer> {
    const file = await api.getFile(fileId);
    if (!file.file_path) {
        throw new Error('Не удалось получить файл из Telegram');
    }

    const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const proxy = proxyUrl?.trim();
    const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

    const buffer = await downloadFileBuffer(url, agent);
    if (buffer.length > MAX_PROOF_BYTES) {
        throw new Error('Файл слишком большой (максимум 5 МБ)');
    }

    return buffer;
}

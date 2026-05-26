import type { Api } from 'grammy';
import { GrammyError, InputFile } from 'grammy';

export function normalizeChatId(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('@') || trimmed.startsWith('-')) return trimmed;
    if (/^100\d+$/.test(trimmed)) return `-${trimmed}`;
    return trimmed;
}

export function getChannelIdFromEnv(): string | null {
    const raw = (process.env.TELEGRAM_CHANNEL_ID ?? process.env.TG_CHANNEL_ID)?.trim();
    return raw ? normalizeChatId(raw) : null;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlToTelegramHtml(html: string): string {
    let s = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '\n<b>')
        .replace(/<\/h[1-6]>/gi, '</b>\n')
        .replace(/<strong[^>]*>/gi, '<b>')
        .replace(/<\/strong>/gi, '</b>')
        .replace(/<em[^>]*>/gi, '<i>')
        .replace(/<\/em>/gi, '</i>')
        .replace(/<(del|strike)[^>]*>/gi, '<s>')
        .replace(/<\/(del|strike)>/gi, '</s>')
        .replace(/<mark[^>]*>/gi, '')
        .replace(/<\/mark>/gi, '')
        .replace(/<hr\s*\/?>/gi, '\n———\n')
        .replace(/<blockquote[^>]*>/gi, '\n')
        .replace(/<\/blockquote>/gi, '\n')
        .replace(/<ul[^>]*>/gi, '\n')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '\n')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<div[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '');

    s = s.replace(/&nbsp;/g, ' ');
    s = s.replace(/<(?!\/?(b|i|u|s|code|pre|a)(\s|>|\/))[^>]*>/gi, '');
    s = s.replace(/\n{3,}/g, '\n\n').trim();
    return s;
}

export interface PostProduct {
    name: string;
    description: string | null;
    pricePerUnit: unknown;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unit: { shortName: string } | null;
}

const TELEGRAM_CAPTION_MAX = 1024;
const TELEGRAM_MESSAGE_MAX = 4096;

export type ChannelPostPhoto = {
    data: Buffer;
    mimeType: string;
};

export function productPhotoToAttachment(photo: {
    data: Uint8Array | Buffer;
    mimeType: string;
}): ChannelPostPhoto {
    return {
        data: Buffer.isBuffer(photo.data) ? photo.data : Buffer.from(photo.data),
        mimeType: photo.mimeType || 'image/jpeg',
    };
}

function photoFilename(mimeType: string): string {
    switch (mimeType) {
        case 'image/png':
            return 'photo.png';
        case 'image/webp':
            return 'photo.webp';
        case 'image/gif':
            return 'photo.gif';
        default:
            return 'photo.jpg';
    }
}

export function buildProductPostText(product: PostProduct, purchaseTag: string): string {
    const rawTag = purchaseTag.replace(/^#/, '');
    const hashtag = `#${escapeHtml(rawTag)}`;
    const desc = product.description?.trim();
    if (desc) {
        return htmlToTelegramHtml(desc) + '\n\n' + hashtag;
    }

    const lines: string[] = [`<b>${escapeHtml(product.name)}</b>`];

    if (product.minPackageAmount != null && product.minPackageUnit) {
        lines.push(
            `<b>Минимальная фасовка - ${Number(product.minPackageAmount)} ${escapeHtml(product.minPackageUnit)}</b>`,
        );
    }

    const price = Number(product.pricePerUnit);
    const shortName = product.unit?.shortName ?? 'ед.';
    if (Number.isFinite(price) && price > 0) {
        lines.push(`${price.toLocaleString('ru-RU')} ₽/${escapeHtml(shortName)}`);
    }

    return lines.join('\n') + '\n\n' + hashtag;
}

export async function sendChannelPost(
    api: Api,
    chatId: string,
    text: string,
    photo?: ChannelPostPhoto,
): Promise<{ messageId: number }> {
    if (photo?.data.length) {
        const caption = text.slice(0, TELEGRAM_CAPTION_MAX);
        const file = new InputFile(photo.data, photoFilename(photo.mimeType));
        try {
            const msg = await api.sendPhoto(chatId, file, {
                caption,
                parse_mode: 'HTML',
            });
            return { messageId: msg.message_id };
        } catch (e) {
            const description =
                e instanceof GrammyError ? e.description : e instanceof Error ? e.message : String(e);
            if (!description.includes("can't parse entities")) {
                throw e;
            }
            const plain = caption.replace(/<[^>]+>/g, '');
            const msg = await api.sendPhoto(chatId, file, { caption: plain });
            return { messageId: msg.message_id };
        }
    }

    const htmlText = text.slice(0, TELEGRAM_MESSAGE_MAX);
    try {
        const msg = await api.sendMessage(chatId, htmlText, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        return { messageId: msg.message_id };
    } catch (e) {
        const description =
            e instanceof GrammyError ? e.description : e instanceof Error ? e.message : String(e);
        if (!description.includes("can't parse entities")) {
            throw e;
        }

        const plain = htmlText.replace(/<[^>]+>/g, '');
        const msg = await api.sendMessage(chatId, plain, {
            link_preview_options: { is_disabled: true },
        });
        return { messageId: msg.message_id };
    }
}

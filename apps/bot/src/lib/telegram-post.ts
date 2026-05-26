import type { Api } from 'grammy';
import { GrammyError } from 'grammy';

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
    sku: string | null;
    description: string | null;
    pricePerUnit: unknown;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unit: { shortName: string } | null;
}

export function buildProductPostText(product: PostProduct, purchaseTag: string): string {
    const header = `📦 <b>Закупка ${escapeHtml(purchaseTag)}</b>\n\n`;

    const desc = product.description?.trim();
    if (desc) {
        return header + htmlToTelegramHtml(desc);
    }

    const lines: string[] = [`<b>${escapeHtml(product.name)}</b>`];
    if (product.sku?.trim()) lines.push(escapeHtml(product.sku.trim()));

    if (product.minPackageAmount != null && product.minPackageUnit) {
        lines.push(
            `Минимальная фасовка — ${Number(product.minPackageAmount)} ${escapeHtml(product.minPackageUnit)}`,
        );
    }

    const price = Number(product.pricePerUnit);
    const shortName = product.unit?.shortName ?? 'ед.';
    if (Number.isFinite(price) && price > 0) {
        lines.push(`${price.toLocaleString('ru-RU')} ₽/${escapeHtml(shortName)}`);
    }

    return header + lines.join('\n');
}

export async function sendChannelPost(
    api: Api,
    chatId: string,
    text: string,
): Promise<{ messageId: number }> {
    const htmlText = text.slice(0, 4096);

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

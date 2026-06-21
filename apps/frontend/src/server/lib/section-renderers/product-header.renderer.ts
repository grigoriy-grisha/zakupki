import { getUnitByCode } from '@zakupki/types';

import { escapeHtmlLocal, formatNumberRu, BaseSectionRenderer, type SectionProps } from './base-section-renderer';

export interface ProductHeaderData {
    name: string;
    description: string | null;
    pricePerUnit: unknown;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unitCode: string;
}

/**
 * Верх поста в канале: описание товара (HTML) ИЛИ имя + фасовка + цена (если описания нет).
 * HTML-разметка описания приводится к Telegram-HTML через простую нормализацию.
 */
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

export class ProductHeaderRenderer extends BaseSectionRenderer<ProductHeaderData> {
    readonly id = 'PRODUCT_HEADER' as const;

    render({ data }: SectionProps<ProductHeaderData>): string | null {
        const desc = data.description?.trim();
        if (desc) {
            return htmlToTelegramHtml(desc);
        }

        const lines: string[] = [`<b>${escapeHtmlLocal(data.name)}</b>`];

        if (data.minPackageAmount != null && data.minPackageUnit) {
            lines.push(
                `<b>Минимальная фасовка - ${Number(data.minPackageAmount)} ${escapeHtmlLocal(data.minPackageUnit)}</b>`,
            );
        }

        const price = Number(data.pricePerUnit);
        const shortName = data.unitCode ? (getUnitByCode(data.unitCode)?.shortName ?? 'ед.') : 'ед.';
        if (Number.isFinite(price) && price > 0) {
            lines.push(`${formatNumberRu(price)} ₽/${escapeHtmlLocal(shortName)}`);
        }

        return lines.join('\n');
    }
}

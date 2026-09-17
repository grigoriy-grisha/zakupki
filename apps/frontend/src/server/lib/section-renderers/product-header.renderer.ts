import { formatQtyUnit, getUnitByCode } from '@zakupki/types';

import { BaseSectionRenderer, escapeHtmlLocal, formatNumberRu, type SectionProps } from './base-section-renderer';

export interface ProductHeaderData {
    name: string;
    description: string | null;
    unitPriceRub: number | null;
    minPackageAmount: unknown;
    minPackageUnit: string | null;
    unitCode: string;
}

function htmlToTelegramHtml(html: string): string {
    const EMPTY_P_SENTINEL = '@@EMPTY_P@@';
    let s = html
        .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, EMPTY_P_SENTINEL)
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
    return s.split(EMPTY_P_SENTINEL).join('\n\n');
}

export class ProductHeaderRenderer extends BaseSectionRenderer<ProductHeaderData> {
    readonly id = 'PRODUCT_HEADER' as const;

    render({ data }: SectionProps<ProductHeaderData>): string | null {
        const nameLine = `<b>${escapeHtmlLocal(data.name)}</b>`;

        const desc = data.description?.trim();
        if (desc) {
            const descHtml = htmlToTelegramHtml(desc).trim();
            return descHtml ? `${nameLine}\n\n${descHtml}` : nameLine;
        }

        const lines: string[] = [nameLine];

        if (data.minPackageAmount != null && data.minPackageUnit) {
            const amount = Number(data.minPackageAmount);
            lines.push(
                `<b>Минимальная фасовка - ${escapeHtmlLocal(formatQtyUnit(amount, data.minPackageUnit))}</b>`,
            );
        }

        const price = data.unitPriceRub;
        const shortName = data.unitCode ? (getUnitByCode(data.unitCode)?.shortName ?? 'ед.') : 'ед.';
        if (price != null && Number.isFinite(price) && price > 0) {
            lines.push(`${formatNumberRu(price)} ₽/${escapeHtmlLocal(shortName)}`);
        }

        return lines.join('\n');
    }
}

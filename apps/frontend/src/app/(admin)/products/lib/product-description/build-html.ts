import { stripAttributesFromName } from '../product-label';
import { isPositive, formatNumber } from '@/lib/utils/format';

import type { DescriptionFields } from './types';
import { normalizeNovelHtml } from './normalize-html';
import { blankParagraph, paragraph, boldParagraph, boldLinesParagraph, linesParagraph, formatStockLine } from './template-engine';

/** HTML для NovelEditor (смежные строки — через <br>, без лишних <p>) */
export function buildDescriptionHtml(input: DescriptionFields): string {
    const blocks: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(input.name ?? '', input.articleNumber, input.attributeNames ?? []);

    const line1 = (input.titleAttributes ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
    const line2Parts: string[] = [];
    if (article) line2Parts.push(article);
    if (displayName) line2Parts.push(displayName);
    const line2 = line2Parts.length ? line2Parts.join('  ') : '';

    const headerLines = [line1, line2].filter(Boolean);
    if (headerLines.length) blocks.push(boldLinesParagraph(headerLines));

    const chars = input.productCharacteristics?.filter((c) => c.name && c.value) ?? [];
    if (chars.length > 0) {
        blocks.push(blankParagraph());
        blocks.push(linesParagraph(chars.map((c) => `${c.name}: ${c.value}`)));
    }

    if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
        blocks.push(blankParagraph());
        blocks.push(
            boldParagraph(`Минимальная фасовка  - ${formatNumber(input.minPackageAmount)} ${input.minPackageUnit}`),
        );
    }

    const stockLine = formatStockLine(input);
    if (stockLine) {
        blocks.push(blankParagraph());
        blocks.push(paragraph(`СВОБОДНО: ${stockLine}`));
    }

    return normalizeNovelHtml(blocks.join(''));
}

import { stripAttributesFromName } from '@/lib/product-label';
import { isPositive, formatNumber } from '@/lib/utils/format';

import type { DescriptionFields } from './types';
import { formatStockLine } from './template-engine';

/** Текст описания для закупки / Telegram */
export function buildProductDescriptionText(input: DescriptionFields): string {
    const lines: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(input.name ?? '', input.articleNumber, input.attributeNames ?? []);

    const line1 = (input.titleAttributes ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
    if (line1) lines.push(line1);

    const line2Parts: string[] = [];
    if (article) line2Parts.push(article);
    if (displayName) line2Parts.push(displayName);
    if (line2Parts.length) lines.push(line2Parts.join('  '));

    const chars = input.productCharacteristics?.filter((c) => c.name && c.value) ?? [];
    if (chars.length > 0) {
        lines.push('');
        for (const c of chars) {
            lines.push(`${c.name}: ${c.value}`);
        }
    }

    if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
        lines.push('');
        lines.push(`Минимальная фасовка  - ${formatNumber(input.minPackageAmount)} ${input.minPackageUnit}`);
    }

    const stockLine = formatStockLine(input);
    if (stockLine) {
        lines.push('');
        lines.push(`СВОБОДНО: ${stockLine}`);
    }

    return lines.join('\n');
}

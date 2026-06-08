import { stripAttributesFromName } from '../product-label';
import { isPositive, formatNumber, formatRubles } from '@/lib/utils/format';

import type { DescriptionFields } from './types';
import { formatSupplierPackageLines } from './template-engine';

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

    const validTiers =
        input.priceTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];

    if (validTiers.length > 0) {
        lines.push('');
        for (const tier of validTiers) {
            lines.push(`${formatNumber(tier.amount!)} ${tier.unit!} - ${formatNumber(tier.price!)} руб`);
        }
    }

    const supplierLines = formatSupplierPackageLines(input);
    if (supplierLines.length > 0) {
        lines.push('');
        lines.push('Фасовка поставщика:');
        for (const line of supplierLines) {
            lines.push(line);
        }
    }

    if (input.referenceStock != null && Number(input.referenceStock) >= 0 && input.referenceStockUnit) {
        lines.push('');
        lines.push(`СВОБОДНО: ${formatNumber(input.referenceStock)} ${input.referenceStockUnit}`);
    }

    return lines.join('\n');
}

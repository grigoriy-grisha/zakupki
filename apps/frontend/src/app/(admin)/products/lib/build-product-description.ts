import { useEffect, useMemo, useRef } from 'react';
import type { ProductLabelSource } from './format-product-label';
import { getProductDisplayName } from './format-product-label';

export interface DescriptionFields {
    name?: string;
    articleNumber?: string;
    manufacturer?: string;
    size?: string;
    form?: string;
    productLine?: string;
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    priceTiers?: { amount?: number; unit?: string; price?: number }[];
    supplierPackageAmount?: number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: number | null;
    availableAmount?: number | null;
    availableUnit?: string | null;
    purchaseTag?: string;
}

export function productToDescriptionFields(product: ProductLabelSource): Omit<DescriptionFields, 'name'> {
    return {
        articleNumber: product.articleNumber ?? undefined,
        manufacturer: product.manufacturer?.name,
        size: product.size?.name,
        form: product.form?.name,
        productLine: product.productLine?.name,
    };
}

/** Текст описания для закупки / Telegram */
export function buildProductDescriptionText(input: DescriptionFields): string {
    const lines: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = getProductDisplayName({
        name: input.name ?? '',
        articleNumber: input.articleNumber,
        manufacturer: input.manufacturer ? { name: input.manufacturer } : null,
        size: input.size ? { name: input.size } : null,
        form: input.form ? { name: input.form } : null,
        productLine: input.productLine ? { name: input.productLine } : null,
    });

    const line1 = [input.manufacturer?.trim(), input.productLine?.trim()].filter(Boolean).join(' ');
    if (line1) lines.push(line1);

    const line2Parts: string[] = [];
    if (article) line2Parts.push(article);
    if (displayName) line2Parts.push(displayName);
    if (line2Parts.length) lines.push(line2Parts.join('  '));

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

    if (
        isPositive(input.supplierPackageAmount) &&
        input.supplierPackageUnit &&
        isPositive(input.supplierPackagePrice)
    ) {
        lines.push('');
        lines.push('Фасовка поставщика:');
        lines.push(
            `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatNumber(input.supplierPackagePrice)} руб`,
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        lines.push('');
        lines.push(`СВОБОДНО: ${formatNumber(input.availableAmount)} ${input.availableUnit}`);
    }

    if (input.purchaseTag?.trim()) {
        lines.push('');
        const tag = input.purchaseTag.trim();
        lines.push(tag.startsWith('#') ? tag : `#${tag}`);
    }

    return lines.join('\n');
}

/** HTML для NovelEditor (смежные строки — через &lt;br&gt;, без лишних &lt;p&gt;) */
export function buildDescriptionHtml(input: DescriptionFields): string {
    const blocks: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = getProductDisplayName({
        name: input.name ?? '',
        articleNumber: input.articleNumber,
        manufacturer: input.manufacturer ? { name: input.manufacturer } : null,
        size: input.size ? { name: input.size } : null,
        form: input.form ? { name: input.form } : null,
        productLine: input.productLine ? { name: input.productLine } : null,
    });

    const line1 = [input.manufacturer?.trim(), input.productLine?.trim()].filter(Boolean).join(' ');
    const line2Parts: string[] = [];
    if (article) line2Parts.push(article);
    if (displayName) line2Parts.push(displayName);
    const line2 = line2Parts.length ? line2Parts.join('  ') : '';

    const headerLines = [line1, line2].filter(Boolean);
    if (headerLines.length) blocks.push(boldLinesParagraph(headerLines));

    if (isPositive(input.minPackageAmount) && input.minPackageUnit) {
        blocks.push(blankParagraph());
        blocks.push(
            boldParagraph(`Минимальная фасовка  - ${formatNumber(input.minPackageAmount)} ${input.minPackageUnit}`),
        );
    }

    const validTiers =
        input.priceTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];

    if (validTiers.length > 0) {
        blocks.push(blankParagraph());
        blocks.push(
            linesParagraph(
                validTiers.map(
                    (tier) => `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatNumber(tier.price!)} руб.`,
                ),
            ),
        );
    }

    if (
        isPositive(input.supplierPackageAmount) &&
        input.supplierPackageUnit &&
        isPositive(input.supplierPackagePrice)
    ) {
        blocks.push(blankParagraph());
        blocks.push(
            mixedParagraph(
                'Фасовка поставщика:',
                `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatNumber(input.supplierPackagePrice)} руб.`,
            ),
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        blocks.push(blankParagraph());
        blocks.push(paragraph(`СВОБОДНО: ${formatNumber(input.availableAmount)} ${input.availableUnit}`));
    }

    if (input.purchaseTag?.trim()) {
        blocks.push(blankParagraph());
        const tag = input.purchaseTag.trim();
        blocks.push(paragraph(tag.startsWith('#') ? tag : `#${tag}`));
    }

    return blocks.join('');
}

function blankParagraph(): string {
    return '<p></p>';
}

function paragraph(text: string): string {
    return `<p>${escapeHtml(text)}</p>`;
}

function boldParagraph(text: string): string {
    return `<p><strong>${escapeHtml(text)}</strong></p>`;
}

/** Несколько жирных строк в одном абзаце (без пустой строки между ними) */
function boldLinesParagraph(lines: string[]): string {
    return `<p><strong>${lines.map(escapeHtml).join('<br>')}</strong></p>`;
}

/** Несколько обычных строк в одном абзаце */
function linesParagraph(lines: string[]): string {
    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
}

/** Жирная строка + обычная в одном абзаце */
function mixedParagraph(boldLine: string, normalLine: string): string {
    return `<p><strong>${escapeHtml(boldLine)}</strong><br>${escapeHtml(normalLine)}</p>`;
}

export function useAutoProductDescription(
    fields: DescriptionFields,
    setDescription: (html: string) => void,
) {
    const lastGeneratedRef = useRef('');
    const stableKey = useMemo(() => JSON.stringify(fields), [fields]);

    useEffect(() => {
        const html = buildDescriptionHtml(fields);
        if (html === lastGeneratedRef.current) return;
        lastGeneratedRef.current = html;
        setDescription(html);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableKey]);
}

function isPositive(v: number | null | undefined): v is number {
    return typeof v === 'number' && isFinite(v) && v > 0;
}

function formatNumber(v: number | null | undefined): string {
    if (v == null || !isFinite(Number(v))) return '';
    const n = Number(v);
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2).replace(/\.?0+$/, '');
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

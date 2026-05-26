/**
 * Shared utilities for building product description HTML.
 * Used by product-form.tsx and items-tab.tsx.
 */

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

interface DescriptionInput {
    name: string;
    categoryName?: string;
    minPackageAmount: number | null;
    minPackageUnit: string | null;
    priceTiers: { amount: number; unit: string; price: number }[];
    supplierPackageAmount: number | null;
    supplierPackageUnit: string | null;
    supplierPackagePrice: number | null;
}

export function buildDescriptionHtml(input: DescriptionInput): string {
    const lines: string[] = [];
    const cat = (input.categoryName ?? '').trim();
    const name = input.name.trim();

    if (cat) lines.push(`<p><strong>${escapeHtml(cat)}</strong><br/><strong>${escapeHtml(name)}</strong></p>`);
    else if (name) lines.push(`<p><strong>${escapeHtml(name)}</strong></p>`);

    if (input.minPackageAmount && input.minPackageAmount > 0 && input.minPackageUnit) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>Минимальная фасовка - ${formatNumber(input.minPackageAmount)} ${escapeHtml(input.minPackageUnit)}</strong></p>`,
        );
    }

    const validTiers = input.priceTiers.filter((t) => t.amount > 0 && t.price > 0);
    if (validTiers.length > 0) {
        if (lines.length) lines.push('<p></p>');
        for (const t of validTiers) {
            lines.push(`<p>${formatNumber(t.amount)} ${escapeHtml(t.unit)} - ${formatNumber(t.price)} руб</p>`);
        }
    }

    if (input.supplierPackageAmount && input.supplierPackageAmount > 0 && input.supplierPackageUnit && input.supplierPackagePrice && input.supplierPackagePrice > 0) {
        if (lines.length) lines.push('<p></p>');
        lines.push(
            `<p><strong>Фасовка поставщика:</strong><br/>${formatNumber(input.supplierPackageAmount)} ${escapeHtml(input.supplierPackageUnit)} - ${formatNumber(input.supplierPackagePrice)} руб</p>`,
        );
    }

    return lines.join('');
}

function formatNumber(v: number | null | undefined): string {
    if (v == null || !isFinite(Number(v))) return '';
    const n = Number(v);
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(2).replace(/\.?0+$/, '');
}

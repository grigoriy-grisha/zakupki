export type ProductLabelSource = {
    name: string;
    articleNumber?: string | null;
    manufacturer?: { name: string } | null;
    size?: { name: string } | null;
    form?: { name: string } | null;
    productLine?: { name: string } | null;
    photos?: { id: number }[];
};

/** Подпись: MIYUKI · Delica 11/0 · Цилиндр · 11/0 · DB-0002 */
export function formatProductAttributesLine(product: ProductLabelSource): string {
    return [
        product.manufacturer?.name,
        product.productLine?.name,
        product.form?.name,
        product.size?.name,
        product.articleNumber?.trim() || null,
    ]
        .filter((p): p is string => Boolean(p))
        .join(' · ');
}

export function getProductPhotoId(product: ProductLabelSource): number | null {
    return product.photos?.[0]?.id ?? null;
}

/** Только название товара без производителя, категории, номера и т.д. */
export function getProductDisplayName(product: ProductLabelSource): string {
    const raw = (product.name ?? '').trim();
    if (!raw) return '';

    const article = product.articleNumber?.trim();
    const lines = raw.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);

    if (lines.length >= 2) {
        let candidate = lines[lines.length - 1];
        if (article) {
            candidate = candidate.replace(new RegExp(`^${escapeRegExp(article)}\\s*`, 'i'), '').trim();
        }
        if (candidate) return candidate;
    }

    const attrLine = formatProductAttributesLine(product);
    if (attrLine) {
        const lower = raw.toLowerCase();
        const prefix = attrLine.toLowerCase();
        if (lower.startsWith(prefix)) {
            const rest = raw.slice(attrLine.length).replace(/^[·\s]+/, '').trim();
            if (rest) return stripArticlePrefix(rest, article);
        }
    }

    const tokens = [
        product.manufacturer?.name,
        product.productLine?.name,
        product.form?.name,
        product.size?.name,
        article,
    ].filter((t): t is string => Boolean(t?.trim()));

    let rest = raw;
    for (const token of tokens) {
        const re = new RegExp(`^${escapeRegExp(token)}\\s*`, 'i');
        if (re.test(rest)) {
            rest = rest.replace(re, '').trim();
        }
    }

    return stripArticlePrefix(rest, article) || raw;
}

function stripArticlePrefix(text: string, article?: string): string {
    if (!article) return text.trim();
    return text.replace(new RegExp(`^${escapeRegExp(article)}\\s*`, 'i'), '').trim();
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

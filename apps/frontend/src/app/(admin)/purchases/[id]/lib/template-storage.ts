const LAST_TEMPLATE_KEY = 'zakupki:last-post-template';

export function templateStorageKey(productId: number) {
    return `zakupki:product-template:${productId}`;
}

/** Шаблон при редактировании в закупке: для товара → последний общий → первый в списке. */
export function resolveDefaultTemplateId(productId: number, postTemplates: { id: number }[] | undefined): string {
    if (!postTemplates?.length) return 'none';
    if (typeof window === 'undefined') return String(postTemplates[0].id);

    const perProduct = sessionStorage.getItem(templateStorageKey(productId));
    if (perProduct === 'none') return 'none';
    if (perProduct && postTemplates.some((t) => String(t.id) === perProduct)) return perProduct;

    const lastUsed = sessionStorage.getItem(LAST_TEMPLATE_KEY);
    if (lastUsed === 'none') return 'none';
    if (lastUsed && postTemplates.some((t) => String(t.id) === lastUsed)) return lastUsed;

    return String(postTemplates[0].id);
}

export function persistTemplateChoice(productId: number, templateId: string) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(templateStorageKey(productId), templateId);
    sessionStorage.setItem(LAST_TEMPLATE_KEY, templateId);
}

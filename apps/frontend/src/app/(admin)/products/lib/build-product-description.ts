import type { ProductLabelSource } from './format-product-label';
import {
    getProductAttributeNames,
    getProductTitleAttributeNames,
    stripAttributesFromName,
    type AttributeTypeMeta,
    type ShowInTitleByTypeId,
} from './format-product-label';
import { isPositive, formatNumber, formatRubles } from '@/lib/utils/format';
import { escapeHtml, escapeRegExp } from '@/lib/utils/html';

export interface DescriptionFields {
    name?: string;
    articleNumber?: string;
    /** Название бренда товара. */
    brandName?: string;
    /** Значения атрибутов для первой строки заголовка (по порядку типов). */
    titleAttributes?: string[];
    /** Все значения атрибутов — для очистки названия. */
    attributeNames?: string[];
    /** Характеристики товара (Цвет: …, Размер: …). */
    productCharacteristics?: { name: string; value: string }[];
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

export function productToDescriptionFields(
    product: ProductLabelSource,
    showInTitleByTypeId?: ShowInTitleByTypeId,
    attributeTypes?: AttributeTypeMeta[],
): Omit<DescriptionFields, 'name'> {
    return {
        articleNumber: product.articleNumber ?? undefined,
        brandName: getProductBrandName(product) || undefined,
        titleAttributes: getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes),
        attributeNames: getProductAttributeNames(product, attributeTypes),
        productCharacteristics: getProductCharacteristics(product),
    };
}

function getProductBrandName(product: ProductLabelSource): string {
    const fromRelation = product.brand?.name?.trim();
    if (fromRelation) return fromRelation;
    for (const v of product.attributeValues ?? []) {
        if (v.attribute.isBrand) {
            const name = v.attribute.name?.trim();
            if (name) return name;
        }
    }
    return '';
}

function getProductCharacteristics(product: ProductLabelSource): { name: string; value: string }[] {
    return (product.characteristicValues ?? [])
        .map((v) => ({
            name: v.characteristic.name?.trim() ?? '',
            value: v.value?.trim() ?? '',
        }))
        .filter((c) => c.name && c.value);
}

/** Текст описания для закупки / Telegram */
export function buildProductDescriptionText(input: DescriptionFields): string {
    const lines: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(input.name ?? '', input.articleNumber, input.attributeNames ?? []);

    const line1 = (input.titleAttributes ?? []).map((s) => s.trim()).filter(Boolean).join(' ');
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

    if (
        isPositive(input.supplierPackageAmount) &&
        input.supplierPackageUnit &&
        isPositive(input.supplierPackagePrice)
    ) {
        lines.push('');
        lines.push('Фасовка поставщика:');
        lines.push(
            `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatRubles(input.supplierPackagePrice)} руб`,
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        lines.push('');
        lines.push(`СВОБОДНО: ${formatNumber(input.availableAmount)} ${input.availableUnit}`);
    }

    return lines.join('\n');
}

/** HTML для NovelEditor (смежные строки — через &lt;br&gt;, без лишних &lt;p&gt;) */
export function buildDescriptionHtml(input: DescriptionFields): string {
    const blocks: string[] = [];
    const article = (input.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(input.name ?? '', input.articleNumber, input.attributeNames ?? []);

    const line1 = (input.titleAttributes ?? []).map((s) => s.trim()).filter(Boolean).join(' ');
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

    const validTiers =
        input.priceTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];

    if (validTiers.length > 0) {
        blocks.push(blankParagraph());
        blocks.push(
            linesParagraph(
                validTiers.map(
                    (tier) => `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatNumber(tier.price!)} руб`,
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
                `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatRubles(input.supplierPackagePrice)} руб`,
            ),
        );
    }

    if (input.availableAmount != null && Number(input.availableAmount) >= 0 && input.availableUnit) {
        blocks.push(blankParagraph());
        blocks.push(paragraph(`СВОБОДНО: ${formatNumber(input.availableAmount)} ${input.availableUnit}`));
    }

    return normalizeNovelHtml(blocks.join(''));
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

/** Несколько строк через &lt;br&gt; без обёртки &lt;p&gt; — для подстановки в шаблон. */
function linesInline(lines: string[]): string {
    return lines.map(escapeHtml).join('<br>');
}

/** Подсказки для редактора шаблонов постов (вставляйте как {{ключ}}). */
export const POST_TEMPLATE_PLACEHOLDERS: { key: string }[] = [
    { key: 'название' },
    { key: 'номер' },
    { key: 'бренд' },
    { key: 'заголовок' },
    { key: 'атрибуты' },
    { key: 'характеристики' },
    { key: 'мин фасовка' },
    { key: 'цены' },
    { key: 'фасовка поставщика' },
    { key: 'свободно' },
    { key: 'тег' },
];

const LEGACY_PLACEHOLDER_HINT_FRAGMENTS = [
    'Всё описание целиком — например: автотекст из полей закупки',
    'Название товара (строкой) — например: синий ирис',
    'Атрибуты (строкой) — например: MIYUKI · Delica 11/0 · …',
    'Если меток нет, при публикации в конец добавится полное автоматическое описание (как',
    'Если меток в шаблоне нет, при публикации в конец добавится полное автоматическое описание из полей закупки.',
    'Копируйте только метки вроде',
    'без подписей списка. Если в шаблон попал старый текст подсказок',
    'Атрибуты с галочкой «в заголовок» попадают в метку',
    'не в {{название}}',
    'Имя из карточки, без атрибутов',
    'Артикул / номер товара',
    'Атрибуты с галочкой «в заголовок»',
    'Все значения справочников одной строкой',
    'Цвет, размер и др. из карточки товара',
    'Мин. фасовка из формы в закупке',
    'Все ценовые строки из закупки',
    'Фасовка и цена у поставщика',
    'Строка «СВОБОДНО: …»',
    'Тег текущей закупки (#…)',
    'Название товара — например: синий ирис',
    'Номер (артикул) — например: DB-0002',
    'Первая строка (атрибуты в шапке) — например: MIYUKI Delica 11/0',
    'Все атрибуты через · — например: MIYUKI · Delica 11/0 · …',
    'Блок характеристик — например: Цвет: …, Размер: …',
    'Минимальная фасовка — например: 5 гр',
    'Список цен — например: 5 гр - 100 руб',
    'Фасовка поставщика — например: 111 гр - 111 руб',
    'Свободный остаток — например: СВОБОДНО: 10 гр',
    'Тег закупки — например: #закупка_май',
];

/** Убирает только строки-подсказки из редактора шаблонов (не трогает текст подстановки). */
export function stripPlaceholderHintDebris(html: string): string {
    const fragments = [...LEGACY_PLACEHOLDER_HINT_FRAGMENTS].sort((a, b) => b.length - a.length);

    let result = html ?? '';
    for (const frag of fragments) {
        if (frag) result = result.split(frag).join('');
    }
    return result;
}

function normalizePlaceholderKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function formatSupplierPackageLine(fields: DescriptionFields): string {
    if (
        !isPositive(fields.supplierPackageAmount) ||
        !fields.supplierPackageUnit ||
        !isPositive(fields.supplierPackagePrice)
    ) {
        return '';
    }
    return `${formatNumber(fields.supplierPackageAmount)} ${fields.supplierPackageUnit} - ${formatRubles(fields.supplierPackagePrice)} руб`;
}

/** Подставляет поля товара в шаблон поста по меткам {{ключ}}. Только значения полей, без подписей. */
export function applyPostTemplate(templateHtml: string, fields: DescriptionFields): string {
    const tpl = (templateHtml ?? '').trim();
    if (!tpl) return '';

    const values = buildPlaceholderValues(fields, buildDescriptionHtml(fields));
    const result = tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/gi, (match, rawKey) => {
        const key = normalizePlaceholderKey(rawKey);
        return key in values ? (values[key] ?? '') : match;
    });
    return normalizeNovelHtml(stripPlaceholderHintDebris(result));
}

function buildPlaceholderValues(fields: DescriptionFields, fullHtml: string): Record<string, string> {
    const article = (fields.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(
        fields.name ?? '',
        fields.articleNumber,
        fields.attributeNames ?? [],
    );
    const line1 = (fields.titleAttributes ?? []).map((s) => s.trim()).filter(Boolean).join(' ');
    const attributesLine = (fields.attributeNames ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' · ');

    const chars = fields.productCharacteristics?.filter((c) => c.name && c.value) ?? [];

    const validTiers =
        fields.priceTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];

    const tagRaw = fields.purchaseTag?.trim() ?? '';
    const tag = tagRaw ? (tagRaw.startsWith('#') ? tagRaw : `#${tagRaw}`) : '';
    const brandName = (fields.brandName ?? '').trim();

    const nameHtml = displayName ? escapeHtml(displayName) : '';
    const attrsHtml = attributesLine ? escapeHtml(attributesLine) : '';

    return {
        /** Для старых шаблонов с {{описание}} */
        описание: fullHtml,
        название: nameHtml,
        название_строка: nameHtml,
        номер: article ? escapeHtml(article) : '',
        бренд: brandName ? escapeHtml(brandName) : '',
        заголовок: line1 ? escapeHtml(line1) : '',
        атрибуты: attrsHtml,
        атрибуты_строка: attrsHtml,
        характеристики: chars.length > 0 ? linesInline(chars.map((c) => `${c.name}: ${c.value}`)) : '',
        мин_фасовка:
            isPositive(fields.minPackageAmount) && fields.minPackageUnit
                ? escapeHtml(`${formatNumber(fields.minPackageAmount)} ${fields.minPackageUnit}`)
                : '',
        цены:
            validTiers.length > 0
                ? linesInline(
                      validTiers.map(
                          (tier) =>
                              `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatRubles(tier.price!)} руб`,
                      ),
                  )
                : '',
        фасовка_поставщика: (() => {
            const line = formatSupplierPackageLine(fields);
            return line ? escapeHtml(line) : '';
        })(),
        свободно:
            fields.availableAmount != null &&
            Number(fields.availableAmount) >= 0 &&
            fields.availableUnit
                ? escapeHtml(`${formatNumber(fields.availableAmount)} ${fields.availableUnit}`)
                : '',
        тег: tag ? escapeHtml(tag) : '',
    };
}

/**
 * NovelEditor хранит текст как HTML из абзацев. Пустые строки становятся `<p></p>`/`<p><br></p>`/`<p>&nbsp;</p>`.
 * Из-за них в подставленном тексте появляются «огромные» пробелы. Полностью удаляем абзацы без видимого текста.
 * В браузере используем DOM (надёжно ловит вложенные пустые теги), на сервере — регэкспы как запасной вариант.
 */
export function normalizeNovelHtml(html: string): string {
    const out = (html ?? '').trim();
    if (!out) return '';

    if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
        try {
            const doc = new window.DOMParser().parseFromString(`<body>${out}</body>`, 'text/html');
            const body = doc.body;

            // Разворачиваем вложенные абзацы: <p><p>текст</p></p> → <p>текст</p>
            let nested = true;
            while (nested) {
                nested = false;
                body.querySelectorAll('p > p').forEach((inner) => {
                    const outer = inner.parentElement;
                    if (outer?.tagName === 'P') {
                        outer.replaceWith(inner);
                        nested = true;
                    }
                });
            }

            body.querySelectorAll('p, div, h1, h2, h3, blockquote').forEach((el) => {
                const hasMedia = el.querySelector('img, hr, iframe');
                const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
                if (!hasMedia && text === '') el.remove();
            });
            return body.innerHTML.trim();
        } catch {
            /* fall through to regex */
        }
    }

    let res = out.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<p></p>');
    res = res.replace(/<p>(?:\s|&nbsp;|&#160;|\u00a0)*<\/p>/gi, '<p></p>');
    res = res.replace(/<p>\s*<\/p>\s*/gi, '');
    return res.trim();
}

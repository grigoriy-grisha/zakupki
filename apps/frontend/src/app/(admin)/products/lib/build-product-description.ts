import type { ProductLabelSource } from './format-product-label';
import {
    getProductAttributeNames,
    getProductTitleAttributeNames,
    stripAttributesFromName,
    type AttributeTypeMeta,
    type ShowInTitleByTypeId,
} from './format-product-label';
import { isPositive, formatNumber } from '@/lib/utils/format';
import { escapeHtml, escapeRegExp } from '@/lib/utils/html';

export interface DescriptionFields {
    name?: string;
    articleNumber?: string;
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
        titleAttributes: getProductTitleAttributeNames(product, showInTitleByTypeId, attributeTypes),
        attributeNames: getProductAttributeNames(product, attributeTypes),
        productCharacteristics: getProductCharacteristics(product),
    };
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
            `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatNumber(input.supplierPackagePrice)} руб`,
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
                `${formatNumber(input.supplierPackageAmount)} ${input.supplierPackageUnit} - ${formatNumber(input.supplierPackagePrice)} руб`,
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

function boldInline(text: string): string {
    return `<strong>${escapeHtml(text)}</strong>`;
}

/** Подсказки для редактора шаблонов постов (вставляйте как {{ключ}}). */
export const POST_TEMPLATE_PLACEHOLDERS: {
    key: string;
    label: string;
    description: string;
    example: string;
}[] = [
    { key: 'название', label: 'Название товара', description: 'Имя из карточки, без атрибутов', example: 'синий ирис' },
    { key: 'номер', label: 'Номер (артикул)', description: 'Артикул / номер товара', example: 'DB-0002' },
    {
        key: 'заголовок',
        label: 'Первая строка (атрибуты в шапке)',
        description: 'Атрибуты с галочкой «в заголовок»',
        example: 'MIYUKI Delica 11/0',
    },
    {
        key: 'атрибуты',
        label: 'Все атрибуты через ·',
        description: 'Все значения справочников одной строкой',
        example: 'MIYUKI · Delica 11/0 · …',
    },
    {
        key: 'характеристики',
        label: 'Блок характеристик',
        description: 'Цвет, размер и др. из карточки товара',
        example: 'Цвет: …, Размер: …',
    },
    {
        key: 'мин_фасовка',
        label: 'Минимальная фасовка',
        description: 'Мин. фасовка из формы в закупке',
        example: '5 гр',
    },
    { key: 'цены', label: 'Список цен', description: 'Все ценовые строки из закупки', example: '5 гр - 100 руб' },
    {
        key: 'фасовка_поставщика',
        label: 'Фасовка поставщика',
        description: 'Фасовка и цена у поставщика',
        example: '111 гр - 111 руб',
    },
    { key: 'свободно', label: 'Свободный остаток', description: 'Строка «СВОБОДНО: …»', example: 'СВОБОДНО: 10 гр' },
    { key: 'тег', label: 'Тег закупки', description: 'Тег текущей закупки (#…)', example: '#закупка_май' },
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
];

/** Убирает только строки-подсказки из редактора шаблонов (не трогает текст подстановки). */
export function stripPlaceholderHintDebris(html: string): string {
    const fragments = [
        ...LEGACY_PLACEHOLDER_HINT_FRAGMENTS,
        ...POST_TEMPLATE_PLACEHOLDERS.map((p) => `${p.label} — например: ${p.example}`).filter(
            (s) => s.includes('например:'),
        ),
        ...POST_TEMPLATE_PLACEHOLDERS.map((p) => `${p.label} · ${p.example}`).filter((s) => s.includes(' · ')),
    ].sort((a, b) => b.length - a.length);

    let result = html ?? '';
    for (const frag of fragments) {
        if (frag) result = result.split(frag).join('');
    }
    return result;
}

/** Подставляет поля товара в шаблон поста по меткам {{ключ}}. Без меток — только текст шаблона. */
export function applyPostTemplate(templateHtml: string, fields: DescriptionFields): string {
    const tpl = (templateHtml ?? '').trim();
    if (!tpl) return '';

    const values = buildPlaceholderValues(fields, buildDescriptionHtml(fields));
    let result = tpl;
    for (const [key, value] of Object.entries(values)) {
        result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'gi'), () => value);
    }
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

    const nameHtml = displayName ? escapeHtml(displayName) : '';
    const attrsHtml = attributesLine ? escapeHtml(attributesLine) : '';

    return {
        /** Для старых шаблонов с {{описание}} */
        описание: fullHtml,
        название: nameHtml,
        название_строка: nameHtml,
        номер: article ? escapeHtml(article) : '',
        заголовок: line1 ? boldInline(line1) : '',
        атрибуты: attrsHtml,
        атрибуты_строка: attrsHtml,
        характеристики: chars.length > 0 ? linesInline(chars.map((c) => `${c.name}: ${c.value}`)) : '',
        мин_фасовка:
            isPositive(fields.minPackageAmount) && fields.minPackageUnit
                ? boldInline(
                      `Минимальная фасовка  - ${formatNumber(fields.minPackageAmount)} ${fields.minPackageUnit}`,
                  )
                : '',
        цены:
            validTiers.length > 0
                ? linesInline(
                      validTiers.map(
                          (tier) =>
                              `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatNumber(tier.price!)} руб`,
                      ),
                  )
                : '',
        фасовка_поставщика:
            isPositive(fields.supplierPackageAmount) &&
            fields.supplierPackageUnit &&
            isPositive(fields.supplierPackagePrice)
                ? `${boldInline('Фасовка поставщика:')}<br>${escapeHtml(`${formatNumber(fields.supplierPackageAmount)} ${fields.supplierPackageUnit} - ${formatNumber(fields.supplierPackagePrice)} руб`)}`
                : '',
        свободно:
            fields.availableAmount != null &&
            Number(fields.availableAmount) >= 0 &&
            fields.availableUnit
                ? escapeHtml(`СВОБОДНО: ${formatNumber(fields.availableAmount)} ${fields.availableUnit}`)
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

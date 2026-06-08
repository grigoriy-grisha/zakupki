import { computeDiscountedPackPrice, isGramSupplierPackProduct } from '@zakupki/types';

import { stripAttributesFromName } from '../product-label';
import { isPositive, formatNumber, formatRubles } from '@/lib/utils/format';
import { escapeHtml } from '@/lib/utils/html';

import type { DescriptionFields } from './types';
import { normalizeNovelHtml } from './normalize-html';
import { buildDescriptionHtml } from './build-html';

export function blankParagraph(): string {
    return '<p></p>';
}

export function paragraph(text: string): string {
    return `<p>${escapeHtml(text)}</p>`;
}

export function boldParagraph(text: string): string {
    return `<p><strong>${escapeHtml(text)}</strong></p>`;
}

/** Несколько жирных строк в одном абзаце (без пустой строки между ними) */
export function boldLinesParagraph(lines: string[]): string {
    return `<p><strong>${lines.map(escapeHtml).join('<br>')}</strong></p>`;
}

/** Несколько обычных строк в одном абзаце */
export function linesParagraph(lines: string[]): string {
    return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
}

/** Жирная строка + обычная в одном абзаце */
export function mixedParagraph(boldLine: string, normalLine: string): string {
    return `<p><strong>${escapeHtml(boldLine)}</strong><br>${escapeHtml(normalLine)}</p>`;
}

/** Несколько строк через <br> без обёртки <p> — для подстановки в шаблон. */
export function linesInline(lines: string[]): string {
    return lines.map(escapeHtml).join('<br>');
}

export function formatSupplierPackageLines(fields: DescriptionFields): string[] {
    const tiers =
        fields.supplierPackageTiers?.filter((t) => t && isPositive(t.amount) && t.unit && isPositive(t.price)) ?? [];
    if (tiers.length > 0) {
        return tiers.map((tier) => `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatRubles(tier.price!)} руб`);
    }
    if (
        isPositive(fields.supplierPackageAmount) &&
        fields.supplierPackageUnit &&
        isPositive(fields.supplierPackagePrice)
    ) {
        return [
            `${formatNumber(fields.supplierPackageAmount)} ${fields.supplierPackageUnit} - ${formatRubles(fields.supplierPackagePrice)} руб`,
        ];
    }
    return [];
}

function formatDiscountedPackLine(fields: DescriptionFields): string {
    if (!isGramSupplierPackProduct(fields)) return '';
    const packPrice = Number(fields.supplierPackagePrice);
    const discount = fields.packDiscountPercent ?? 3;
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return '';
    const discounted = computeDiscountedPackPrice(packPrice, discount);
    return `${formatNumber(fields.supplierPackageAmount!)} ${fields.supplierPackageUnit} - ${formatRubles(discounted)} руб`;
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
    { key: 'цена со скидкой за пачку' },
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
    'Цена со скидкой за пачку — например: 50 гр - 1229 руб (только бисер в гр)',
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

/** Подставляет поля товара в шаблон поста по меткам {{ключ}}. Только значения полей, без подписей. */
export function applyPostTemplate(templateHtml: string, fields: DescriptionFields): string {
    const tpl = (templateHtml ?? '').trim();
    if (!tpl) return '';

    const fullHtml = buildDescriptionHtml(fields);
    const values = buildPlaceholderValues(fields, fullHtml);
    const result = tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/gi, (match, rawKey) => {
        const key = normalizePlaceholderKey(rawKey);
        return key in values ? (values[key] ?? '') : match;
    });
    return normalizeNovelHtml(stripPlaceholderHintDebris(result));
}

function buildPlaceholderValues(fields: DescriptionFields, fullHtml: string): Record<string, string> {
    const article = (fields.articleNumber ?? '').trim();
    const displayName = stripAttributesFromName(fields.name ?? '', fields.articleNumber, fields.attributeNames ?? []);
    const line1 = (fields.titleAttributes ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
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
                          (tier) => `${formatNumber(tier.amount!)} ${tier.unit!} - ${formatRubles(tier.price!)} руб`,
                      ),
                  )
                : '',
        фасовка_поставщика: (() => {
            const lines = formatSupplierPackageLines(fields);
            return lines.length > 0 ? linesInline(lines) : '';
        })(),
        цена_со_скидкой_за_пачку: (() => {
            const line = formatDiscountedPackLine(fields);
            return line ? escapeHtml(line) : '';
        })(),
        свободно:
            fields.referenceStock != null && Number(fields.referenceStock) >= 0 && fields.referenceStockUnit
                ? escapeHtml(`${formatNumber(fields.referenceStock)} ${fields.referenceStockUnit}`)
                : '',
        тег: tag ? escapeHtml(tag) : '',
    };
}

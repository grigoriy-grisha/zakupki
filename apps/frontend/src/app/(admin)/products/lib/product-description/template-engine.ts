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

/** Подсказки для редактора шаблонов постов (вставляйте как {{ключ}}). */
export const POST_TEMPLATE_PLACEHOLDERS: { key: string }[] = [
    { key: 'название' },
    { key: 'номер' },
    { key: 'бренд' },
    { key: 'заголовок' },
    { key: 'атрибуты' },
    { key: 'характеристики' },
    { key: 'мин фасовка' },
    { key: 'цена за пачку' },
    { key: 'вес упаковки' },
    { key: 'свободно' },
    { key: 'тег' },
    { key: 'поставщик' },
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
    'Имя поставщика — например: Поставщик 1',
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

/** Значение для метки {{свободно}}: «СВОБОДНО: 45 гр». Возвращает null если supplierLimit не задан. */
export function formatStockLine(fields: DescriptionFields): string | null {
    const amount = fields.supplierLimit;
    const unit = fields.supplierLimitUnit;
    if (amount == null || Number(amount) < 0 || !unit) return null;
    return `${formatNumber(amount)} ${unit}`;
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
        цена_за_пачку:
            isPositive(fields.pricePerPackCurrency) && fields.currencyName
                ? escapeHtml(`${formatNumber(fields.pricePerPackCurrency!)} ${fields.currencyName}`)
                : '',
        вес_упаковки:
            isPositive(fields.packAmount) && fields.packUnit
                ? escapeHtml(`${formatNumber(fields.packAmount!)} ${fields.packUnit}`)
                : '',
        свободно: formatStockLine(fields) ? escapeHtml(formatStockLine(fields) as string) : '',
        тег: tag ? escapeHtml(tag) : '',
        поставщик: fields.supplierName ? escapeHtml(fields.supplierName) : '',
    };
}

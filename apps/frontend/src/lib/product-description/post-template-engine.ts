import { stripAttributesFromName } from '@/lib/product-label';
import { formatNumber, formatRubles, isPositive } from '@/lib/utils/format';
import { escapeHtml } from '@/lib/utils/html';

import type { DescriptionFields } from './types';
import { normalizeNovelHtml } from './normalize-html';
import { productDescriptionBuilder } from './product-description-builder';
import { linesInline } from './paragraphs';
import { formatStockLine } from './stock-line';

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
    { key: 'цены' },
    { key: 'фасовка поставщика' },
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

function normalizePlaceholderKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
}

const KNOWN_PLACEHOLDER_KEYS: ReadonlySet<string> = new Set(
    POST_TEMPLATE_PLACEHOLDERS.map((p) => normalizePlaceholderKey(p.key)),
);

export class PostTemplateEngine {
    apply(templateHtml: string, fields: DescriptionFields): string {
        const tpl = (templateHtml ?? '').trim();
        if (!tpl) return '';

        const fullHtml = productDescriptionBuilder.buildHtml(fields);
        const values = this.buildPlaceholderValues(fields, fullHtml);
        const result = tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/gi, (match, rawKey) => {
            const key = normalizePlaceholderKey(rawKey);
            return key in values ? (values[key] ?? '') : match;
        });
        return normalizeNovelHtml(this.stripPlaceholderHintDebris(result));
    }

    findUnknownPlaceholders(templateHtml: string): string[] {
        const unknown: string[] = [];
        const seen = new Set<string>();
        (templateHtml ?? '').replace(/\{\{\s*([^}]+?)\s*\}\}/gi, (match, rawKey: string) => {
            const key = normalizePlaceholderKey(rawKey);
            if (!KNOWN_PLACEHOLDER_KEYS.has(key) && !seen.has(key)) {
                seen.add(key);
                unknown.push(rawKey.trim());
            }
            return match;
        });
        return unknown;
    }

    stripPlaceholderHintDebris(html: string): string {
        const fragments = [...LEGACY_PLACEHOLDER_HINT_FRAGMENTS].sort((a, b) => b.length - a.length);

        let result = html ?? '';
        for (const frag of fragments) {
            if (frag) result = result.split(frag).join('');
        }
        return result;
    }

    private buildPlaceholderValues(fields: DescriptionFields, fullHtml: string): Record<string, string> {
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
            цены: (() => {
                const u = fields.unitPriceRub;
                if (!isPositive(u)) return '';
                const unit = fields.packUnit ?? fields.minPackageUnit ?? '';
                const lines = [`1 ${unit} - ${formatRubles(u)} руб`];
                const min = fields.minPackageAmount;
                if (isPositive(min)) {
                    const minTotal = Number(u) * Number(min);
                    lines.push(`${formatNumber(min)} ${unit} - ${formatRubles(minTotal)} руб`);
                }
                return linesInline(lines);
            })(),
            фасовка_поставщика: (() => {
                const u = fields.unitPriceRub;
                const amt = fields.packAmount;
                const unit = fields.packUnit;
                if (!isPositive(amt) || !unit || !isPositive(u)) return '';
                const total = Number(u) * Number(amt);
                return linesInline(['ФАСОВКА ПОСТАВЩИКА:', `${formatNumber(amt)} ${unit} - ${formatRubles(total)} руб`]);
            })(),
            цена_со_скидкой_за_пачку:
                isPositive(fields.pricePerPackCurrency) && fields.currencyName
                    ? escapeHtml(`${formatNumber(fields.pricePerPackCurrency!)} ${fields.currencyName}`)
                    : '',
        };
    }
}

export const postTemplateEngine = new PostTemplateEngine();

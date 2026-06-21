/**
 * Базовый класс для всех рендереров секций постов и комментариев.
 * Каждый рендерер — pure-функция: получает типизированные данные, возвращает строку (или null).
 *
 * Никаких API-вызовов, никакого I/O. Это позволяет:
 *   1) тривиально покрывать рендер snapshot-тестами;
 *   2) переиспользовать один рендерер в production-коде и в тестах;
 *   3) гарантировать, что один и тот же текст даёт одинаковый результат вне зависимости от источника.
 */

export type RendererId =
    | 'PRODUCT_HEADER'
    | 'STATUS_LINE'
    | 'FULFILLMENT_COMMENT'
    | 'PURCHASE_STATUS_COMMENT'
    | 'SHOP_COMMENT';

export interface SectionProps<TData> {
    id: RendererId;
    data: TData;
}

/** Произвольный JSON-сериализуемый контекст — только для тестов и логирования. */
export type AnyData = Record<string, unknown> | string | number | boolean | null | undefined;

export abstract class BaseSectionRenderer<TData = unknown> {
    abstract readonly id: RendererId;
    abstract render(props: SectionProps<TData>): string | null;
}

/** Локальный escape HTML для использования в рендерерах (без зависимости от bot/lib). */
export function escapeHtmlLocal(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Форматирование чисел в ru-RU — единая точка для всех рендереров. */
export function formatNumberRu(n: number): string {
    return n.toLocaleString('ru-RU');
}

/** Склеивает строки через \n, отбрасывая null/пустые. */
export function joinNonEmpty(lines: ReadonlyArray<string | null | undefined>): string {
    return lines.filter((s): s is string => typeof s === 'string' && s.length > 0).join('\n');
}

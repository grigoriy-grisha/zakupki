/**
 * Реестр рендереров секций. Один источник правды для всех постов и комментариев.
 * Используется в production (`TgPostWorker`) и в тестах (`renderById`).
 */

import { BaseSectionRenderer, type RendererId, type SectionProps } from './base-section-renderer';
import { FulfillmentCommentRenderer } from './fulfillment-comment.renderer';
import { ProductHeaderRenderer } from './product-header.renderer';
import { PurchaseStatusCommentRenderer } from './purchase-status-comment.renderer';
import { ShopCommentRenderer } from './shop-comment.renderer';
import { StatusLineRenderer } from './status-line.renderer';

export type RendererRegistry = {
    [K in RendererId]: BaseSectionRenderer<unknown>;
};

export function initSectionRenderers(): RendererRegistry {
    return {
        PRODUCT_HEADER: new ProductHeaderRenderer() as BaseSectionRenderer<unknown>,
        STATUS_LINE: new StatusLineRenderer() as BaseSectionRenderer<unknown>,
        FULFILLMENT_COMMENT: new FulfillmentCommentRenderer() as BaseSectionRenderer<unknown>,
        PURCHASE_STATUS_COMMENT: new PurchaseStatusCommentRenderer() as BaseSectionRenderer<unknown>,
        SHOP_COMMENT: new ShopCommentRenderer() as BaseSectionRenderer<unknown>,
    };
}

/** Singleton — создаётся один раз при первом обращении. */
let _registry: RendererRegistry | null = null;
export function getSectionRenderers(): RendererRegistry {
    if (!_registry) _registry = initSectionRenderers();
    return _registry;
}

export function renderById<TData>(id: RendererId, data: TData): string | null {
    const renderer = getSectionRenderers()[id] as BaseSectionRenderer<TData>;
    return renderer.render({ id, data });
}

// Re-exports
export { BaseSectionRenderer } from './base-section-renderer';
export type { RendererId, SectionProps, AnyData } from './base-section-renderer';
export { FulfillmentCommentRenderer, type FulfillmentCommentData } from './fulfillment-comment.renderer';
export { ProductHeaderRenderer, type ProductHeaderData } from './product-header.renderer';
export {
    PurchaseStatusCommentRenderer,
    type PurchaseStatusCommentData,
} from './purchase-status-comment.renderer';
export { ShopCommentRenderer, type ShopCommentData, SHOP_COMMENT_TEXT } from './shop-comment.renderer';
export { StatusLineRenderer, type StatusLineData } from './status-line.renderer';

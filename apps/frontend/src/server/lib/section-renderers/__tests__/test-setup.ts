import { PURCHASE_FULFILLMENT_STATUSES, type PurchaseFulfillmentStatus } from '@zakupki/types';

import { initSectionRenderers, type RendererId, type SectionProps } from '../index';
import type { BaseSectionRenderer } from '../base-section-renderer';
import type { FulfillmentCommentData } from '../fulfillment-comment.renderer';
import type { ProductHeaderData } from '../product-header.renderer';
import type { PurchaseStatusCommentData } from '../purchase-status-comment.renderer';
import type { ShopCommentData } from '../shop-comment.renderer';
import type { StatusLineData } from '../status-line.renderer';

const renderers = initSectionRenderers();

/**
 * Универсальный рендер секции по id. Используется в snapshot-тестах.
 * В production-коде — `renderById` из '../index'.
 */
export function renderById<TData>(id: RendererId, data: TData): string | null {
    const renderer = renderers[id] as BaseSectionRenderer<TData>;
    return renderer.render({ id, data });
}

// --- Мок-фабрики для snapshot-тестов ---

export function createMockProductHeader(overrides: Partial<ProductHeaderData> = {}): ProductHeaderData {
    return {
        name: 'Болгарский перец',
        description: null,
        unitPriceRub: 250,
        minPackageAmount: 1,
        minPackageUnit: 'кг',
        unitCode: 'kg',
        ...overrides,
    };
}

export function createMockStatusLineData(overrides: Partial<StatusLineData> = {}): StatusLineData {
    return {
        item: { supplierLimit: 500, supplierLimitUnit: 'кг' },
        purchase: { fulfillmentStatus: 'REORDER' },
        orderLinesSum: 100,
        ...overrides,
    };
}

export function createMockFulfillmentCommentData(
    overrides: Partial<FulfillmentCommentData> = {},
): FulfillmentCommentData {
    return { status: 'PAYMENT', channelPostMessageId: 123, ...overrides };
}

export function createMockPurchaseStatusCommentData(
    overrides: Partial<PurchaseStatusCommentData> = {},
): PurchaseStatusCommentData {
    return { status: 'ACTIVE', channelPostMessageId: 123, ...overrides };
}

export function createMockShopCommentData(overrides: Partial<ShopCommentData> = {}): ShopCommentData {
    return { ...overrides };
}

/** Все 9 fulfillment-статусов — для parametrised-тестов. */
export const ALL_FULFILLMENT_STATUSES = PURCHASE_FULFILLMENT_STATUSES as readonly PurchaseFulfillmentStatus[];

export const ALL_PURCHASE_STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARRIVED', 'DONE'] as const;

import type { PrismaClient } from '@zakupki/database';
import { BusinessRuleError } from '@zakupki/types';

export const ACTIVE_PURCHASE_STATUS = 'ACTIVE' as const;

export function formatPurchaseTag(tag: string): string {
    const trimmed = tag.trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export async function findActivePurchaseTagsForProduct(db: PrismaClient, productId: number): Promise<string[]> {
    const items = await db.purchaseItem.findMany({
        where: { productId, purchase: { status: ACTIVE_PURCHASE_STATUS } },
        select: { purchase: { select: { tag: true } } },
    });
    return [...new Set(items.map((item) => item.purchase.tag))];
}

export async function findProductIdsInActivePurchases(db: PrismaClient, productIds: number[]): Promise<Set<number>> {
    if (productIds.length === 0) return new Set();
    const rows = await db.purchaseItem.findMany({
        where: { productId: { in: productIds }, purchase: { status: ACTIVE_PURCHASE_STATUS } },
        select: { productId: true },
        distinct: ['productId'],
    });
    return new Set(rows.map((row) => row.productId));
}

export async function assertProductNotInActivePurchase(db: PrismaClient, productId: number): Promise<void> {
    const tags = await findActivePurchaseTagsForProduct(db, productId);
    if (tags.length === 0) return;

    const list = tags.map(formatPurchaseTag).join(', ');
    throw new BusinessRuleError(
        'PRODUCT_IN_ACTIVE_PURCHASE',
        `Товар участвует в активной закупке ${list}. Удаление из каталога недоступно.`,
    );
}

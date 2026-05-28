import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@zakupki/database';

export const ACTIVE_PURCHASE_STATUS = 'ACTIVE' as const;

function formatPurchaseTag(tag: string): string {
    return tag.startsWith('#') ? tag : `#${tag}`;
}

export async function findActivePurchaseTagsForProduct(db: PrismaClient, productId: number): Promise<string[]> {
    const items = await db.purchaseItem.findMany({
        where: { productId, purchase: { status: ACTIVE_PURCHASE_STATUS } },
        select: { purchase: { select: { tag: true } } },
    });
    return [...new Set(items.map((item) => item.purchase.tag))];
}

export async function findProductIdsInActivePurchases(
    db: PrismaClient,
    productIds: number[],
): Promise<Set<number>> {
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
    throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Товар участвует в активной закупке ${list}. Удаление из каталога недоступно.`,
    });
}

export function assertCanRemoveFromActivePurchase(purchaseStatus: string, purchaseTag: string): void {
    if (purchaseStatus !== ACTIVE_PURCHASE_STATUS) return;

    throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Нельзя удалить товар из активной закупки ${formatPurchaseTag(purchaseTag)}`,
    });
}

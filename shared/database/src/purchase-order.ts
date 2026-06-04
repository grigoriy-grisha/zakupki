import type { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

export async function ensurePurchaseOrder(tx: TransactionClient, userId: number, purchaseId: number) {
    return tx.purchaseOrder.upsert({
        where: { userId_purchaseId: { userId, purchaseId } },
        create: { userId, purchaseId },
        update: {},
    });
}

export async function deletePurchaseOrderIfNoLines(tx: TransactionClient, userId: number, purchaseId: number) {
    const count = await tx.orderLine.count({
        where: { userId, purchaseItem: { purchaseId } },
    });
    if (count === 0) {
        await tx.purchaseOrder.deleteMany({ where: { userId, purchaseId } });
    }
}

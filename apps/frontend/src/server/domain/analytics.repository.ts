import { dbClient, Prisma } from '@zakupki/database';

/** Закупки, которые ещё «в работе»: не черновики, не завершённые и не удалённые. */
const OPEN_PURCHASE_STATUSES = ['ACTIVE', 'CLOSED', 'ARRIVED'] as const;

/** Статусы выдачи, при которых заказ уже у участника или отложен по договорённости. */
const HANDED_OFF_STATUSES = ['SENT', 'RECEIVED', 'STORED'] as const;

type Range = { from: Date; to: Date };

export class AnalyticsRepository {
    /** Строки заказов, созданные в диапазоне, с данными для расшифровки суммы. */
    async findOrderLinesCreated({ from, to }: Range) {
        return this.loadStatLines(Prisma.sql`
            ol."createdAt" >= ${from} AND ol."createdAt" < ${to}
            AND pi."purchaseId" IN (SELECT id FROM "Purchase" WHERE "deletedAt" IS NULL)
        `);
    }

    /**
     * Активные строки заказов плоским SQL + позиции и закупки отдельными запросами.
     * Вложенный select Prisma на ~10 тыс. строк в 3–5 раз медленнее: он тянет одну и ту же
     * позицию и курсы для каждой строки и разворачивает Decimal.
     */
    private async loadStatLines(where: Prisma.Sql) {
        const rows = await dbClient.$queryRaw<
            Array<{
                userId: number;
                amountDue: number;
                quantity: number;
                packageCount: number | null;
                createdAt: Date;
                createdOnStage: string;
                purchaseItemId: number;
                purchaseId: number;
            }>
        >`
            SELECT ol."userId", ol."amountDue"::float8 AS "amountDue", ol.quantity::float8 AS quantity,
                   ol."packageCount"::float8 AS "packageCount", ol."createdAt", ol."createdOnStage"::text AS "createdOnStage",
                   ol."purchaseItemId", pi."purchaseId"
            FROM "OrderLine" ol
            JOIN "PurchaseItem" pi ON pi.id = ol."purchaseItemId"
            WHERE ol.status = 'ACTIVE' AND ${where}
        `;
        if (rows.length === 0) return [];

        const itemIds = [...new Set(rows.map((r) => r.purchaseItemId))];
        const purchaseIds = [...new Set(rows.map((r) => r.purchaseId))];
        const [items, purchases, rates] = await Promise.all([
            dbClient.$queryRaw<
                Array<{
                    id: number;
                    purchaseId: number;
                    unitCode: string | null;
                    supplierId: number | null;
                    supplierName: string | null;
                    productName: string;
                    productUnitCode: string | null;
                    currencyId: number | null;
                    pricePerPackCurrency: number | null;
                    packAmount: number | null;
                    orgFeePercentOverride: number | null;
                    deliveryPercentOverride: number | null;
                }>
            >`
                SELECT pi.id, pi."purchaseId", pi."unitCode", pi."supplierId", s.name AS "supplierName",
                       pr.name AS "productName", pr."unitCode" AS "productUnitCode", pi."currencyId",
                       pi."pricePerPackCurrency"::float8 AS "pricePerPackCurrency", pi."packAmount"::float8 AS "packAmount",
                       pi."orgFeePercentOverride"::float8 AS "orgFeePercentOverride",
                       pi."deliveryPercentOverride"::float8 AS "deliveryPercentOverride"
                FROM "PurchaseItem" pi
                JOIN "Product" pr ON pr.id = pi."productId"
                LEFT JOIN "Supplier" s ON s.id = pi."supplierId"
                WHERE pi.id IN (${Prisma.join(itemIds)})
            `,
            dbClient.$queryRaw<Array<{ id: number; deliveryPercent: number | null }>>`
                SELECT id, "deliveryPercent"::float8 AS "deliveryPercent" FROM "Purchase" WHERE id IN (${Prisma.join(purchaseIds)})
            `,
            dbClient.$queryRaw<Array<{ purchaseId: number; currencyId: number; rateToRub: number }>>`
                SELECT "purchaseId", "currencyId", "rateToRub"::float8 AS "rateToRub"
                FROM "PurchaseCurrencyRate" WHERE "purchaseId" IN (${Prisma.join(purchaseIds)})
            `,
        ]);

        const purchaseById = new Map(
            purchases.map((p) => [
                p.id,
                {
                    deliveryPercent: p.deliveryPercent,
                    currencyRates: rates
                        .filter((r) => r.purchaseId === p.id)
                        .map((r) => ({ currencyId: r.currencyId, rateToRub: r.rateToRub })),
                },
            ]),
        );
        const itemById = new Map(
            items.map((item) => [
                item.id,
                {
                    id: item.id,
                    purchaseId: item.purchaseId,
                    unitCode: item.unitCode,
                    supplierId: item.supplierId,
                    supplier: item.supplierName != null ? { name: item.supplierName } : null,
                    product: { name: item.productName, unitCode: item.productUnitCode },
                    currencyId: item.currencyId,
                    pricePerPackCurrency: item.pricePerPackCurrency,
                    packAmount: item.packAmount,
                    orgFeePercentOverride: item.orgFeePercentOverride,
                    deliveryPercentOverride: item.deliveryPercentOverride,
                    purchase: purchaseById.get(item.purchaseId) ?? { deliveryPercent: null, currencyRates: [] },
                },
            ]),
        );

        return rows.flatMap((row) => {
            const purchaseItem = itemById.get(row.purchaseItemId);
            return purchaseItem
                ? [
                      {
                          userId: row.userId,
                          amountDue: row.amountDue,
                          quantity: row.quantity,
                          packageCount: row.packageCount,
                          createdAt: row.createdAt,
                          createdOnStage: row.createdOnStage,
                          purchaseItem,
                      },
                  ]
                : [];
        });
    }

    /** Подтверждённые оплаты верхнего уровня, оплаченные в диапазоне; дочерние — промо-скидки. */
    async findConfirmedPayments({ from, to }: Range) {
        return dbClient.payment.findMany({
            where: {
                parentId: null,
                status: 'CONFIRMED',
                purchase: { deletedAt: null },
                OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, submittedAt: { gte: from, lt: to } }],
            },
            select: {
                amount: true,
                paidAt: true,
                submittedAt: true,
                children: { select: { amount: true } },
            },
        });
    }

    async findClientsCreated({ from, to }: Range) {
        return dbClient.user.findMany({
            where: { role: 'CLIENT', createdAt: { gte: from, lt: to } },
            select: { createdAt: true },
        });
    }

    async findOpenPurchases() {
        return dbClient.purchase.findMany({
            where: { deletedAt: null, status: { in: [...OPEN_PURCHASE_STATUSES] } },
            select: { id: true, tag: true, status: true, fulfillmentStatus: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Сумма к оплате по каждому участнику закупок (только активные строки). */
    async findParticipantDues(purchaseIds: number[]) {
        if (purchaseIds.length === 0) return [];
        return dbClient.$queryRaw<Array<{ purchaseId: number; userId: number; due: number }>>`
            SELECT pi."purchaseId" AS "purchaseId", ol."userId" AS "userId", SUM(ol."amountDue")::float8 AS due
            FROM "OrderLine" ol
            JOIN "PurchaseItem" pi ON pi.id = ol."purchaseItemId"
            WHERE ol.status = 'ACTIVE' AND pi."purchaseId" IN (${Prisma.join(purchaseIds)})
            GROUP BY pi."purchaseId", ol."userId"
        `;
    }

    /** Платежи участников; total = сумма + промо-скидки (дочерние платежи), как в computePaymentTotals. */
    async findParticipantPayments(purchaseIds: number[]) {
        if (purchaseIds.length === 0) return [];
        return dbClient.$queryRaw<Array<{ purchaseId: number; userId: number; status: string; total: number }>>`
            SELECT p."purchaseId" AS "purchaseId", p."userId" AS "userId", p.status::text AS status,
                   (p.amount + COALESCE((SELECT SUM(c.amount) FROM "Payment" c WHERE c."parentId" = p.id), 0))::float8 AS total
            FROM "Payment" p
            WHERE p."parentId" IS NULL AND p."purchaseId" IN (${Prisma.join(purchaseIds)})
        `;
    }

    /** Новые строки заказов по закупкам начиная с `from` — для мини-графика в таблице. */
    async findRecentOrderAmounts(purchaseIds: number[], from: Date) {
        if (purchaseIds.length === 0) return [];
        return dbClient.$queryRaw<Array<{ purchaseId: number; createdAt: Date; amount: number }>>`
            SELECT pi."purchaseId" AS "purchaseId", ol."createdAt" AS "createdAt", ol."amountDue"::float8 AS amount
            FROM "OrderLine" ol
            JOIN "PurchaseItem" pi ON pi.id = ol."purchaseItemId"
            WHERE ol.status = 'ACTIVE' AND ol."createdAt" >= ${from} AND pi."purchaseId" IN (${Prisma.join(purchaseIds)})
        `;
    }

    async countPendingManualPayments() {
        const where: Prisma.PaymentWhereInput = { parentId: null, status: 'PENDING', purchase: { deletedAt: null } };
        const [count, oldest] = await Promise.all([
            dbClient.payment.count({ where }),
            dbClient.payment.findFirst({ where, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true } }),
        ]);
        return { count, oldestAt: oldest?.submittedAt ?? null };
    }

    /** Онлайн-оплаты, открытые дольше `olderThan`: клиент ушёл с формы или банк не прислал уведомление. */
    async countStaleOnlinePayments(olderThan: Date) {
        return dbClient.payment.count({
            where: {
                parentId: null,
                status: 'AWAITING',
                submittedAt: { lt: olderThan },
                purchase: { deletedAt: null },
            },
        });
    }

    /** Заказы в закупках на этапе «К выдаче», которые ещё не отданы участнику. */
    async countOrdersAwaitingHandoff() {
        const groups = await dbClient.purchaseOrder.groupBy({
            by: ['purchaseId'],
            _count: { _all: true },
            where: {
                purchase: {
                    deletedAt: null,
                    status: { in: [...OPEN_PURCHASE_STATUSES] },
                    fulfillmentStatus: 'READY_FOR_PICKUP',
                },
                OR: [{ handoffStatus: null }, { handoffStatus: { notIn: [...HANDED_OFF_STATUSES] } }],
                orderLines: { some: { status: 'ACTIVE' } },
            },
        });
        return { count: groups.reduce((acc, g) => acc + g._count._all, 0), purchases: groups.length };
    }

    // ── Одна закупка (вкладка «Статистика») ─────────────────────────

    private readonly statsPurchaseSelect = {
        id: true,
        tag: true,
        status: true,
        fulfillmentStatus: true,
        createdAt: true,
        currencyRates: {
            select: {
                currencyId: true,
                rateToRub: true,
                currency: { select: { name: true, code: true, symbol: true } },
            },
        },
    } satisfies Prisma.PurchaseSelect;

    async findPurchaseForStats(purchaseId: number) {
        return dbClient.purchase.findUnique({ where: { id: purchaseId }, select: this.statsPurchaseSelect });
    }

    /** Все закупки, кроме черновиков и удалённых, — для общей статистики. */
    async findAllPurchasesForStats() {
        return dbClient.purchase.findMany({
            where: { deletedAt: null, status: { not: 'DRAFT' } },
            select: this.statsPurchaseSelect,
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Активные строки заказов закупок с ценами, поставщиком и единицей измерения. */
    async findPurchaseLines(purchaseIds: number[]) {
        if (purchaseIds.length === 0) return [];
        return this.loadStatLines(Prisma.sql`pi."purchaseId" IN (${Prisma.join(purchaseIds)})`);
    }

    /** Платежи закупок верхнего уровня (включая возвраты с отрицательной суммой); дочерние — промо-скидки. */
    async findPurchasePayments(purchaseIds: number[]) {
        return dbClient.payment.findMany({
            where: { purchaseId: { in: purchaseIds }, parentId: null },
            select: {
                purchaseId: true,
                userId: true,
                status: true,
                amount: true,
                feeAmount: true,
                paidAt: true,
                submittedAt: true,
                refundOfId: true,
                children: { select: { amount: true } },
            },
        });
    }

    /** Заказы участников (с активными строками) и их статус выдачи. */
    async findPurchaseHandoffs(purchaseIds: number[]) {
        return dbClient.purchaseOrder.findMany({
            where: { purchaseId: { in: purchaseIds }, orderLines: { some: { status: 'ACTIVE' } } },
            select: { purchaseId: true, userId: true, handoffStatus: true },
        });
    }

    async findUsersBrief(userIds: number[]) {
        if (userIds.length === 0) return [];
        return dbClient.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true },
        });
    }

    /** Участники, для которых эта закупка — первая: раньше живых заказов в других (неудалённых) закупках не было. */
    async countNewcomers(purchaseId: number): Promise<number> {
        const [row] = await dbClient.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM "PurchaseOrder" po
            WHERE po."purchaseId" = ${purchaseId}
              AND EXISTS (SELECT 1 FROM "OrderLine" ol WHERE ol."purchaseOrderId" = po.id AND ol.status = 'ACTIVE')
              AND NOT EXISTS (
                  SELECT 1
                  FROM "PurchaseOrder" other
                  JOIN "Purchase" p ON p.id = other."purchaseId"
                  WHERE other."userId" = po."userId"
                    AND other."purchaseId" <> po."purchaseId"
                    AND other."createdAt" < po."createdAt"
                    AND p."deletedAt" IS NULL
                    AND EXISTS (SELECT 1 FROM "OrderLine" ol2 WHERE ol2."purchaseOrderId" = other.id AND ol2.status = 'ACTIVE')
              )
        `;
        return row?.count ?? 0;
    }
}

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- Backfill: один заказ на участника в каждой закупке, где есть строки
INSERT INTO "PurchaseOrder" ("userId", "purchaseId", "createdAt", "updatedAt")
SELECT
    ol."userId",
    pi."purchaseId",
    MIN(ol."createdAt"),
    MAX(ol."updatedAt")
FROM "OrderLine" ol
INNER JOIN "PurchaseItem" pi ON pi."id" = ol."purchaseItemId"
GROUP BY ol."userId", pi."purchaseId";

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_userId_purchaseId_key" ON "PurchaseOrder"("userId", "purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_purchaseId_idx" ON "PurchaseOrder"("purchaseId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

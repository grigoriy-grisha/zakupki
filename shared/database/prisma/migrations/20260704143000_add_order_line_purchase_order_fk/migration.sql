-- Add OrderLine.purchaseOrderId FK to PurchaseOrder.
-- Связь обязательна: PurchaseOrder создаётся в OrderRepository.upsertOrderLine
-- до строки OrderLine. Без PurchaseOrder не должно быть OrderLine (бизнес-инвариант).
--
-- Шаги:
-- 1. Добавить nullable колонку.
-- 2. Для существующих OrderLine — подтянуть id PurchaseOrder через JOIN
--    PurchaseItem по (userId, purchaseId). Создать PurchaseOrder, если его
--    нет (для legacy-данных, у которых orderLine существовала без явной записи).
-- 3. ALTER COLUMN NOT NULL + FK + index.

ALTER TABLE "OrderLine" ADD COLUMN "purchaseOrderId" INTEGER;

-- 2. Бэкфилл: для каждой OrderLine — найти/создать PurchaseOrder(userId, purchaseId)
--    и записать его id.
DO $$
DECLARE
    rec RECORD;
    new_po_id INTEGER;
BEGIN
    FOR rec IN
        SELECT ol."id" AS line_id, ol."userId", pi."purchaseId"
        FROM "OrderLine" ol
        JOIN "PurchaseItem" pi ON pi."id" = ol."purchaseItemId"
    LOOP
        -- Найти существующий PurchaseOrder.
        SELECT "id" INTO new_po_id
        FROM "PurchaseOrder"
        WHERE "userId" = rec."userId" AND "purchaseId" = rec."purchaseId"
        LIMIT 1;

        -- Если нет — создать.
        IF new_po_id IS NULL THEN
            INSERT INTO "PurchaseOrder" ("userId", "purchaseId", "createdAt", "updatedAt")
            VALUES (rec."userId", rec."purchaseId", NOW(), NOW())
            RETURNING "id" INTO new_po_id;
        END IF;

        UPDATE "OrderLine" SET "purchaseOrderId" = new_po_id WHERE "id" = rec.line_id;
    END LOOP;
END $$;

-- 3. NOT NULL + FK.
ALTER TABLE "OrderLine" ALTER COLUMN "purchaseOrderId" SET NOT NULL;

ALTER TABLE "OrderLine"
    ADD CONSTRAINT "OrderLine_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

CREATE INDEX "OrderLine_purchaseOrderId_idx" ON "OrderLine"("purchaseOrderId");

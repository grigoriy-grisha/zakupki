ALTER TABLE "ProductCharacteristicValue" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ProductCharacteristicValue_productId_sortOrder_idx" ON "ProductCharacteristicValue"("productId", "sortOrder");

-- Сохранить текущий порядок по position справочника
UPDATE "ProductCharacteristicValue" AS pcv
SET "sortOrder" = c."position"
FROM "Characteristic" AS c
WHERE c."id" = pcv."characteristicId";

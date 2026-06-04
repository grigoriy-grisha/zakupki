-- Порядок характеристик у значения справочника
ALTER TABLE "ProductAttributeCharacteristic" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    pac."attributeId",
    pac."characteristicId",
    ROW_NUMBER() OVER (
      PARTITION BY pac."attributeId"
      ORDER BY c."position" ASC, pac."characteristicId" ASC
    ) - 1 AS pos
  FROM "ProductAttributeCharacteristic" pac
  INNER JOIN "Characteristic" c ON c.id = pac."characteristicId"
)
UPDATE "ProductAttributeCharacteristic" pac
SET "position" = ranked.pos
FROM ranked
WHERE pac."attributeId" = ranked."attributeId"
  AND pac."characteristicId" = ranked."characteristicId";

CREATE INDEX "ProductAttributeCharacteristic_attributeId_position_idx"
  ON "ProductAttributeCharacteristic"("attributeId", "position");

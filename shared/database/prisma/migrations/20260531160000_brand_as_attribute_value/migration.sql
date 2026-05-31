-- Бренд — отдельное значение (третья кнопка), не тип справочника.
ALTER TABLE "ProductAttribute" ADD COLUMN "isBrand" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ProductAttribute" pa
SET "isBrand" = true
FROM "Product" p
WHERE p."brandId" = pa.id;

UPDATE "ProductAttribute" pa
SET "isBrand" = true
FROM "AttributeType" t
WHERE pa."typeId" = t.id AND t."isBrand" = true;

ALTER TABLE "AttributeType" DROP COLUMN IF EXISTS "isBrand";

CREATE INDEX "ProductAttribute_isBrand_idx" ON "ProductAttribute"("isBrand");

-- Характеристика привязывается к значению справочника, а не к типу

ALTER TABLE "ProductAttribute" ADD COLUMN "characteristicId" INTEGER;

ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_characteristicId_fkey"
    FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductAttribute_characteristicId_idx" ON "ProductAttribute"("characteristicId");

ALTER TABLE "AttributeType" DROP CONSTRAINT IF EXISTS "AttributeType_characteristicId_fkey";
DROP INDEX IF EXISTS "AttributeType_characteristicId_idx";
ALTER TABLE "AttributeType" DROP COLUMN IF EXISTS "characteristicId";

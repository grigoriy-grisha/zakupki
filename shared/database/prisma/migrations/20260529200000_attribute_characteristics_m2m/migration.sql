CREATE TABLE "ProductAttributeCharacteristic" (
    "attributeId" INTEGER NOT NULL,
    "characteristicId" INTEGER NOT NULL,

    CONSTRAINT "ProductAttributeCharacteristic_pkey" PRIMARY KEY ("attributeId", "characteristicId")
);

ALTER TABLE "ProductAttributeCharacteristic" ADD CONSTRAINT "ProductAttributeCharacteristic_attributeId_fkey"
    FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAttributeCharacteristic" ADD CONSTRAINT "ProductAttributeCharacteristic_characteristicId_fkey"
    FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductAttributeCharacteristic_characteristicId_idx" ON "ProductAttributeCharacteristic"("characteristicId");

INSERT INTO "ProductAttributeCharacteristic" ("attributeId", "characteristicId")
SELECT "id", "characteristicId" FROM "ProductAttribute" WHERE "characteristicId" IS NOT NULL;

ALTER TABLE "ProductAttribute" DROP CONSTRAINT IF EXISTS "ProductAttribute_characteristicId_fkey";
DROP INDEX IF EXISTS "ProductAttribute_characteristicId_idx";
ALTER TABLE "ProductAttribute" DROP COLUMN IF EXISTS "characteristicId";

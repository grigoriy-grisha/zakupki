-- Характеристики товара (Цвет, Размер, ...) и значения на товаре

CREATE TABLE "Characteristic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Characteristic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Characteristic_name_key" ON "Characteristic"("name");

ALTER TABLE "AttributeType" ADD COLUMN "characteristicId" INTEGER;

ALTER TABLE "AttributeType" ADD CONSTRAINT "AttributeType_characteristicId_fkey"
    FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttributeType_characteristicId_idx" ON "AttributeType"("characteristicId");

CREATE TABLE "ProductCharacteristicValue" (
    "productId" INTEGER NOT NULL,
    "characteristicId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductCharacteristicValue_pkey" PRIMARY KEY ("productId", "characteristicId")
);

ALTER TABLE "ProductCharacteristicValue" ADD CONSTRAINT "ProductCharacteristicValue_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCharacteristicValue" ADD CONSTRAINT "ProductCharacteristicValue_characteristicId_fkey"
    FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductCharacteristicValue_characteristicId_idx" ON "ProductCharacteristicValue"("characteristicId");

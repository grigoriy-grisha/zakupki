-- Drop old fixed attribute FKs/columns on Product
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_manufacturerId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sizeId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_formId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_productLineId_fkey";

DROP INDEX IF EXISTS "Product_manufacturerId_idx";
DROP INDEX IF EXISTS "Product_sizeId_idx";
DROP INDEX IF EXISTS "Product_formId_idx";
DROP INDEX IF EXISTS "Product_productLineId_idx";

ALTER TABLE "Product"
    DROP COLUMN IF EXISTS "manufacturerId",
    DROP COLUMN IF EXISTS "sizeId",
    DROP COLUMN IF EXISTS "formId",
    DROP COLUMN IF EXISTS "productLineId";

-- Drop old attribute table + enum (data intentionally discarded)
DROP TABLE IF EXISTS "ProductAttribute" CASCADE;
DROP TYPE IF EXISTS "ProductAttributeKind";

-- New: attribute types (catalog structure)
CREATE TABLE "AttributeType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "showInTree" BOOLEAN NOT NULL DEFAULT true,
    "showInTitle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributeType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttributeType_name_key" ON "AttributeType"("name");
CREATE INDEX "AttributeType_position_idx" ON "AttributeType"("position");

-- New: attribute values (belong to a type)
CREATE TABLE "ProductAttribute" (
    "id" SERIAL NOT NULL,
    "typeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAttribute_typeId_idx" ON "ProductAttribute"("typeId");
CREATE UNIQUE INDEX "ProductAttribute_typeId_name_key" ON "ProductAttribute"("typeId", "name");

ALTER TABLE "ProductAttribute"
    ADD CONSTRAINT "ProductAttribute_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "AttributeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New: product ↔ attribute value (many-to-many)
CREATE TABLE "ProductAttributeValue" (
    "productId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("productId", "attributeId")
);

CREATE INDEX "ProductAttributeValue_attributeId_idx" ON "ProductAttributeValue"("attributeId");

ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey"
    FOREIGN KEY ("attributeId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

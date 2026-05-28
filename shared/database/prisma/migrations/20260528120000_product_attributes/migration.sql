-- CreateEnum
CREATE TYPE "ProductAttributeKind" AS ENUM ('MANUFACTURER', 'SIZE', 'FORM', 'PRODUCT_LINE');

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" SERIAL NOT NULL,
    "kind" "ProductAttributeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "articleNumber" TEXT,
ADD COLUMN "manufacturerId" INTEGER,
ADD COLUMN "sizeId" INTEGER,
ADD COLUMN "formId" INTEGER,
ADD COLUMN "productLineId" INTEGER;

-- CreateIndex
CREATE INDEX "ProductAttribute_kind_idx" ON "ProductAttribute"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttribute_kind_name_key" ON "ProductAttribute"("kind", "name");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- CreateIndex
CREATE INDEX "Product_sizeId_idx" ON "Product"("sizeId");

-- CreateIndex
CREATE INDEX "Product_formId_idx" ON "Product"("formId");

-- CreateIndex
CREATE INDEX "Product_productLineId_idx" ON "Product"("productLineId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productLineId_fkey" FOREIGN KEY ("productLineId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

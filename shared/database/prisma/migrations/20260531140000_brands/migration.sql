CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Brand_name_idx" ON "Brand"("name");

ALTER TABLE "Product" ADD COLUMN "brandId" INTEGER;

CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

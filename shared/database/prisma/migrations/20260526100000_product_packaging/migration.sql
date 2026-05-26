-- DropColumn
ALTER TABLE "Product" DROP COLUMN "brand";

-- AddColumn
ALTER TABLE "Product"
    ADD COLUMN "minPackageAmount" DECIMAL(10,3),
    ADD COLUMN "minPackageUnit" TEXT,
    ADD COLUMN "priceTiers" JSONB,
    ADD COLUMN "supplierPackageAmount" DECIMAL(10,3),
    ADD COLUMN "supplierPackageUnit" TEXT,
    ADD COLUMN "supplierPackagePrice" DECIMAL(10,2),
    ADD COLUMN "availableAmount" DECIMAL(10,3),
    ADD COLUMN "availableUnit" TEXT;

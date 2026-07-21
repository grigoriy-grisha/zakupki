-- Drop legacy pricing columns from PurchaseItem.
-- The new pricing model (pricePerPackCurrency × rateToRub × orgFee / packAmount)
-- fully replaces the old model (pricePerUnit, priceTiers, priceOverride,
-- supplierPackage*). Data was backfilled to the new columns in a prior migration.

ALTER TABLE "PurchaseItem"
    DROP COLUMN "pricePerUnit",
    DROP COLUMN "priceTiers",
    DROP COLUMN "priceOverride",
    DROP COLUMN "supplierPackageAmount",
    DROP COLUMN "supplierPackageUnit",
    DROP COLUMN "supplierPackagePrice",
    DROP COLUMN "supplierPackageTiers";

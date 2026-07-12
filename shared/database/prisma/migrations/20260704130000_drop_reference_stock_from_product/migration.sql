-- Drop catalog reference stock fields. They were "for reference only" — not used
-- in any business logic. Per-purchaseItem values (targetRemainder / supplierLimit)
-- are the real source of truth and live on PurchaseItem.
--
-- WARNING: any historical referenceStock/referenceStockUnit values stored on
-- Product rows will be lost permanently.
ALTER TABLE "Product" DROP COLUMN "referenceStock";
ALTER TABLE "Product" DROP COLUMN "referenceStockUnit";

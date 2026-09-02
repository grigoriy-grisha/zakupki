-- Per-item delivery percent override (priority over purchase-level deliveryPercent)
ALTER TABLE "PurchaseItem" ADD COLUMN "deliveryPercentOverride" DECIMAL(5,2);

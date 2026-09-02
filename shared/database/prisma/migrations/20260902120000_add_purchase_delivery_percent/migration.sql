-- Add per-purchase delivery percent (additive markup on top of org fee)
ALTER TABLE "Purchase" ADD COLUMN "deliveryPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

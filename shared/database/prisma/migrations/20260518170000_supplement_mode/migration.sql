-- AlterEnum: add SUPPLEMENT to PurchaseStatus
ALTER TYPE "PurchaseStatus" ADD VALUE 'SUPPLEMENT';

-- Add availableQty column to PurchaseItem
ALTER TABLE "PurchaseItem" ADD COLUMN "availableQty" DECIMAL(10,3);

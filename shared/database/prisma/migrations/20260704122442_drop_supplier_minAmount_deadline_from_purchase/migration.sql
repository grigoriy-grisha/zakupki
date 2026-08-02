-- Drop columns that are no longer used.
-- WARNING: data in these columns (Purchase.supplier, Purchase.minAmount, Purchase.deadline) will be lost permanently.
ALTER TABLE "Purchase" DROP COLUMN "supplier";
ALTER TABLE "Purchase" DROP COLUMN "minAmount";
ALTER TABLE "Purchase" DROP COLUMN "deadline";

-- Rename availableAmount/availableUnit -> referenceStock/referenceStockUnit, add version
ALTER TABLE "Product" RENAME COLUMN "availableAmount" TO "referenceStock";
ALTER TABLE "Product" RENAME COLUMN "availableUnit" TO "referenceStockUnit";
ALTER TABLE "Product" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Rename availableQty -> targetRemainder on PurchaseItem
ALTER TABLE "PurchaseItem" RENAME COLUMN "availableQty" TO "targetRemainder";

-- Drop unused columns from PurchaseItem
ALTER TABLE "PurchaseItem" DROP COLUMN "minQty";
ALTER TABLE "PurchaseItem" DROP COLUMN "isActive";
ALTER TABLE "PurchaseItem" DROP COLUMN "shouldPublish";

-- Create enum
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'PUBLISHED');

-- Add publicationState column with default, then update based on existing tgMessageId
ALTER TABLE "PurchaseItem" ADD COLUMN "publicationState" "PublicationState" NOT NULL DEFAULT 'DRAFT';
UPDATE "PurchaseItem" SET "publicationState" = 'PUBLISHED' WHERE "tgMessageId" IS NOT NULL;

-- Drop FK and column from Purchase (supplierId)
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_supplierId_fkey";
ALTER TABLE "Purchase" DROP COLUMN "supplierId";

-- Drop Supplier table
DROP TABLE "Supplier";
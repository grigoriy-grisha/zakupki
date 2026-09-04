-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "unitCode" TEXT NOT NULL DEFAULT 'piece';

-- Backfill item unit snapshot from the catalog product
UPDATE "PurchaseItem" SET "unitCode" = "Product"."unitCode"
FROM "Product" WHERE "PurchaseItem"."productId" = "Product"."id";

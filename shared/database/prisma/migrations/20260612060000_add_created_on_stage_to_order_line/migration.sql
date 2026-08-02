-- AlterTable: add createdOnStage column with default 'COLLECTION'
ALTER TABLE "OrderLine" ADD COLUMN "createdOnStage" "PurchaseFulfillmentStatus" NOT NULL DEFAULT 'COLLECTION';

-- DropIndex: drop old unique constraint
DROP INDEX IF EXISTS "OrderLine_purchaseItemId_userId_key";

-- CreateIndex: new unique constraint including createdOnStage
CREATE UNIQUE INDEX "OrderLine_purchaseItemId_userId_createdOnStage_key" ON "OrderLine"("purchaseItemId" ASC, "userId" ASC, "createdOnStage" ASC);

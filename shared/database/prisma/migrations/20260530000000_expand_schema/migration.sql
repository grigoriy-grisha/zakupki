-- AlterTable
ALTER TABLE "ProductPhoto" ADD COLUMN "objectKey" TEXT;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "supplierId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "RoleKind" NOT NULL DEFAULT 'CLIENT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "proofObjectKey" TEXT;

-- CreateIndex
CREATE INDEX "Payment_parentId_idx" ON "Payment"("parentId");
CREATE INDEX "Payment_promoCodeId_idx" ON "Payment"("promoCodeId");
CREATE INDEX "User_username_idx" ON "User"("username");
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

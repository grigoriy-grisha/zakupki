-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "refundOfId" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_refundOfId_idx" ON "Payment"("refundOfId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

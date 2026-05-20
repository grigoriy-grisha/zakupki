/*
  Warnings:

  - You are about to drop the column `discountAmount` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "discountAmount",
ADD COLUMN     "parentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

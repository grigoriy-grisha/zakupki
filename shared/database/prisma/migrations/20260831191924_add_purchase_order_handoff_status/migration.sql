-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('SENT', 'RECEIVED', 'STORED');

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "handoffAt" TIMESTAMP(3),
ADD COLUMN     "handoffBy" INTEGER,
ADD COLUMN     "handoffStatus" "HandoffStatus";

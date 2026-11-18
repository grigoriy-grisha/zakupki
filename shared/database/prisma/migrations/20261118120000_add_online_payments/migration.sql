-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'TBANK_CARD', 'TBANK_SBP');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

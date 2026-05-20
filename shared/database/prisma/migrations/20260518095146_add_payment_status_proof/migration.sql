-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "proofData" BYTEA,
ADD COLUMN     "proofMimeType" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "userComment" TEXT;

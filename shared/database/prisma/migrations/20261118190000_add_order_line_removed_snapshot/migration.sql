-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedPackageCount" INTEGER,
ADD COLUMN     "removedQuantity" DECIMAL(10,3);

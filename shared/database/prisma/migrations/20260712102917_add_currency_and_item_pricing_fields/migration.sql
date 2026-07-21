-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "adminComment" TEXT,
ADD COLUMN     "assembledQty" DECIMAL(10,3),
ADD COLUMN     "currencyId" INTEGER,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderedQty" DECIMAL(10,3),
ADD COLUMN     "orgFeePercentOverride" DECIMAL(5,2),
ADD COLUMN     "packAmount" DECIMAL(10,3),
ADD COLUMN     "packUnit" TEXT,
ADD COLUMN     "pricePerPackCurrency" DECIMAL(10,2),
ADD COLUMN     "reorderedQty" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "Currency" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "symbol" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseCurrencyRate" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "rateToRub" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseCurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_name_key" ON "Currency"("name");

-- CreateIndex
CREATE INDEX "Currency_position_idx" ON "Currency"("position");

-- CreateIndex
CREATE INDEX "PurchaseCurrencyRate_purchaseId_idx" ON "PurchaseCurrencyRate"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseCurrencyRate_purchaseId_currencyId_key" ON "PurchaseCurrencyRate"("purchaseId", "currencyId");

-- CreateIndex
CREATE INDEX "PurchaseItem_currencyId_idx" ON "PurchaseItem"("currencyId");

-- AddForeignKey
ALTER TABLE "PurchaseCurrencyRate" ADD CONSTRAINT "PurchaseCurrencyRate_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseCurrencyRate" ADD CONSTRAINT "PurchaseCurrencyRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

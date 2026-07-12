-- CreateTable: Supplier (справочник поставщиков)
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");
CREATE INDEX "Supplier_position_idx" ON "Supplier"("position");

-- AlterTable: PurchaseItem — добавляем per-purchase поля + supplierId
ALTER TABLE "PurchaseItem" ADD COLUMN "supplierId" INTEGER;
ALTER TABLE "PurchaseItem" ADD COLUMN "description" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "pricePerUnit" DECIMAL(10,2);
ALTER TABLE "PurchaseItem" ADD COLUMN "minPackageAmount" DECIMAL(10,3);
ALTER TABLE "PurchaseItem" ADD COLUMN "minPackageUnit" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "priceTiers" JSONB;
ALTER TABLE "PurchaseItem" ADD COLUMN "supplierPackageAmount" DECIMAL(10,3);
ALTER TABLE "PurchaseItem" ADD COLUMN "supplierPackageUnit" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN "supplierPackagePrice" DECIMAL(10,2);
ALTER TABLE "PurchaseItem" ADD COLUMN "supplierPackageTiers" JSONB;
-- ВАЖНО: "supplementStep" здесь НЕ добавляем — колонка уже существует на
-- PurchaseItem (см. миграцию 20260609060000_add_supplement_step).

-- Копируем существующие значения с Product в PurchaseItem (для уже созданных
-- позиций). С этого момента Product больше не источник этих данных.
-- supplementStep берём через COALESCE: колонка на PurchaseItem уже была и может
-- содержать своё per-purchase значение — перетираем только NULL.
UPDATE "PurchaseItem" pi
SET
    "description"           = p."description",
    "pricePerUnit"          = p."pricePerUnit",
    "minPackageAmount"      = p."minPackageAmount",
    "minPackageUnit"        = p."minPackageUnit",
    "priceTiers"            = p."priceTiers",
    "supplierPackageAmount" = p."supplierPackageAmount",
    "supplierPackageUnit"   = p."supplierPackageUnit",
    "supplierPackagePrice"  = p."supplierPackagePrice",
    "supplierPackageTiers"  = p."supplierPackageTiers",
    "supplementStep"        = COALESCE(pi."supplementStep", p."supplementStep")
FROM "Product" p
WHERE pi."productId" = p."id";

-- AddForeignKey: PurchaseItem.supplierId → Supplier.id (ON DELETE SET NULL)
ALTER TABLE "PurchaseItem"
    ADD CONSTRAINT "PurchaseItem_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex: снимаем уникальность (purchaseId, productId), чтобы можно было
-- добавлять один товар несколько раз для разных поставщиков. В init это был
-- CREATE UNIQUE INDEX (не табличный CONSTRAINT), поэтому DROP INDEX, не DROP CONSTRAINT.
DROP INDEX IF EXISTS "PurchaseItem_purchaseId_productId_key";

-- CreateIndex: заменяем unique на обычный индекс для быстрого lookup
CREATE INDEX "PurchaseItem_purchaseId_productId_idx" ON "PurchaseItem"("purchaseId", "productId");
CREATE INDEX "PurchaseItem_supplierId_idx" ON "PurchaseItem"("supplierId");

-- DropColumns from Product: вся per-purchase конкретика теперь живёт на PurchaseItem
ALTER TABLE "Product" DROP COLUMN "description";
ALTER TABLE "Product" DROP COLUMN "pricePerUnit";
ALTER TABLE "Product" DROP COLUMN "minPackageAmount";
ALTER TABLE "Product" DROP COLUMN "minPackageUnit";
ALTER TABLE "Product" DROP COLUMN "priceTiers";
ALTER TABLE "Product" DROP COLUMN "supplierPackageAmount";
ALTER TABLE "Product" DROP COLUMN "supplierPackageUnit";
ALTER TABLE "Product" DROP COLUMN "supplierPackagePrice";
ALTER TABLE "Product" DROP COLUMN "supplierPackageTiers";
ALTER TABLE "Product" DROP COLUMN "supplementStep";

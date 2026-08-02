-- Add admin comment fields to PurchaseOrder.
-- Один комментарий на участника (userId+purchaseId) — для заметок по
-- конкретному заказчику, а не по отдельной позиции.
-- commentAt живёт отдельно от PurchaseOrder.updatedAt, чтобы обновление
-- других полей не сбрасывало «дату обновления комментария».
ALTER TABLE "PurchaseOrder" ADD COLUMN "comment" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "commentAuthor" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN "commentAt" TIMESTAMP(3);

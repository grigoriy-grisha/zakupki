ALTER TABLE "ProductAttribute" ADD COLUMN "parentId" INTEGER;

CREATE INDEX "ProductAttribute_parentId_idx" ON "ProductAttribute"("parentId");

ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ProductAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

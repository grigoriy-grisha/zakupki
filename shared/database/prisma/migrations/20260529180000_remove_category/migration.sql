-- Drop legacy Category catalog (catalog uses AttributeType tree)
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";
DROP INDEX IF EXISTS "Product_categoryId_idx";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "categoryId";
DROP TABLE IF EXISTS "Category";

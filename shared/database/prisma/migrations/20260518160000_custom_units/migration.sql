-- 1. Add unitId column to Product (nullable first)
ALTER TABLE "Product" ADD COLUMN "unitId" INTEGER;

-- 2. Set unitId based on existing unit enum values
-- GRAM -> id 1, PIECE -> id 2, etc. (will be created below)
-- We use a CTE to insert units and get their IDs
-- First, drop the old unit column from Product
-- But we need the values first, so let's use a different approach

-- Create a temporary mapping table
CREATE TABLE "_unit_mapping" ("old_unit" TEXT NOT NULL, "new_id" INTEGER NOT NULL);

-- 3. Drop old unit column from Product (we already read the values via the mapping)
-- First store the mapping
INSERT INTO "_unit_mapping" ("old_unit", "new_id") VALUES
    ('GRAM', 1),
    ('PIECE', 2);

-- Set unitId from mapping
UPDATE "Product" p SET "unitId" = m."new_id" FROM "_unit_mapping" m WHERE p."unit"::text = m."old_unit";

-- 4. Drop old unit column and enum
ALTER TABLE "Product" DROP COLUMN "unit";
DROP TYPE "Unit";

-- 5. Now create the Unit table
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "multiplicity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- 6. Seed default units
INSERT INTO "Unit" ("id", "name", "shortName", "multiplicity") VALUES
    (1, 'Граммы', 'г', 5),
    (2, 'Штуки', 'шт', 1);

-- Reset the sequence
SELECT setval('"Unit_id_seq"', (SELECT MAX(id) FROM "Unit"));

-- 7. Make unitId NOT NULL
ALTER TABLE "Product" ALTER COLUMN "unitId" SET NOT NULL;

-- 8. Add foreign key constraint
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Create index on unitId
CREATE INDEX "Product_unitId_idx" ON "Product"("unitId");

-- 10. Clean up
DROP TABLE "_unit_mapping";

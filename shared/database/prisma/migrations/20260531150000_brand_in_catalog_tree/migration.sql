-- Бренды — значения в дереве справочника (тип с isBrand), а не отдельная таблица.
ALTER TABLE "AttributeType" ADD COLUMN "isBrand" BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
    brand_type_id INT;
    r RECORD;
    new_attr_id INT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Brand') THEN
        INSERT INTO "AttributeType" ("name", "parentId", "position", "showInTree", "showInTitle", "isBrand", "createdAt")
        SELECT 'Бренд', NULL, COALESCE((SELECT MAX("position") FROM "AttributeType"), -1) + 1, true, true, true, NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "AttributeType" WHERE "isBrand" = true);

        SELECT id INTO brand_type_id FROM "AttributeType" WHERE "isBrand" = true LIMIT 1;

        FOR r IN SELECT * FROM "Brand" LOOP
            INSERT INTO "ProductAttribute" ("typeId", "name", "position", "createdAt")
            VALUES (brand_type_id, r.name, 0, r."createdAt")
            RETURNING id INTO new_attr_id;

            UPDATE "Product" SET "brandId" = new_attr_id WHERE "brandId" = r.id;
        END LOOP;

        ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_brandId_fkey";
        DROP TABLE "Brand";
    END IF;
END $$;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_brandId_fkey";

ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "ProductAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

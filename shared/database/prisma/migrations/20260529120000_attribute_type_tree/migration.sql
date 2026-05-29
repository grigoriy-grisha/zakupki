-- Иерархия типов атрибутов: тип → подтип → ...
ALTER TABLE "AttributeType" ADD COLUMN "parentId" INTEGER;

CREATE INDEX "AttributeType_parentId_idx" ON "AttributeType"("parentId");

ALTER TABLE "AttributeType"
    ADD CONSTRAINT "AttributeType_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "AttributeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

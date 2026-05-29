-- Включаем все типы атрибутов в заголовок описания по умолчанию
ALTER TABLE "AttributeType" ALTER COLUMN "showInTitle" SET DEFAULT true;

-- Существующие типы тоже включаем в заголовок
UPDATE "AttributeType" SET "showInTitle" = true;

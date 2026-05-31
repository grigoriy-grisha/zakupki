-- Allow duplicate names for attribute types (subtypes) and product attribute values.
DROP INDEX IF EXISTS "AttributeType_name_key";
DROP INDEX IF EXISTS "ProductAttribute_typeId_name_key";

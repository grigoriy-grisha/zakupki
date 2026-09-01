export { buildAttributeTree, collectExpandableIds, matchesPath, productMatchesTreeNode } from './attribute-tree';
export type { PackageUnit, ProductAttributeFormValues,ProductCreateFormValues } from './schema';
export { PACKAGE_UNITS,productAttributeSchema, productCreateSchema } from './schema';
export type { AttributeTypeRow, AttrProduct, PathSegment, TreeNode } from './types';
export {
    type AttributeBrandNode,
    type AttributeListItem,
    type AttributesTreeForType,
    buildAttributesTreeByType,
    findAttributeDisplayName,
    getAttributeCharacteristicIds,
    type PendingFile,
    type ProductCharacteristicsSource,
    resolveProductCharacteristics,
    revokePendingFiles,
} from '@/lib/product-form-utils';

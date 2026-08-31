export {
    getAttributeCharacteristicIds,
    resolveProductCharacteristics,
    buildAttributesTreeByType,
    findAttributeDisplayName,
    revokePendingFiles,
    type AttributeListItem,
    type ProductCharacteristicsSource,
    type AttributeBrandNode,
    type AttributesTreeForType,
    type PendingFile,
} from '@/lib/product-form-utils';

export type { PathSegment, AttributeTypeRow, AttrProduct, TreeNode } from './types';
export { buildAttributeTree, collectExpandableIds, matchesPath, productMatchesTreeNode } from './attribute-tree';
export { productCreateSchema, productAttributeSchema, PACKAGE_UNITS } from './schema';
export type { PackageUnit, ProductCreateFormValues, ProductAttributeFormValues } from './schema';

// Re-export of shared catalog/description logic. The canonical home of these
// modules is `@/lib/product-label`, `@/lib/product-description`, and
// `@/lib/product-form-utils` (server-safe pure TS). This barrel exists for
// backwards-compat with the many admin-UI importers that still import from
// `../../products/lib`; new code should import from `@/lib/*` directly.
export * from '@/lib/product-label';
export * from '@/lib/product-description';
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

// Admin-UI-only modules (not server-safe — React form schemas, attribute tree).
export type { PathSegment, AttributeTypeRow, AttrProduct, TreeNode } from './types';
export { buildAttributeTree, collectExpandableIds, matchesPath, productMatchesTreeNode } from './attribute-tree';
export { productCreateSchema, productAttributeSchema, PACKAGE_UNITS } from './schema';
export type { PackageUnit, ProductCreateFormValues, ProductAttributeFormValues } from './schema';

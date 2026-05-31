export type { PathSegment, AttributeTypeRow, AttrProduct, TreeNode } from './types';
export { buildAttributeTree, collectExpandableIds, matchesPath } from './attribute-tree';
export {
    getAttributeCharacteristicIds,
    groupAttributesByType,
    revokePendingFiles,
    type AttributeListItem,
    type PendingFile,
} from './product-form-utils';
export {
    productCreateSchema,
    productSchema,
    productAttributeSchema,
    priceTierSchema,
    PACKAGE_UNITS,
} from './schema';
export type { PackageUnit, PriceTierValues, ProductCreateFormValues } from './schema';
export type { ProductFormValues, ProductAttributeFormValues } from './schema';
export {
    formatProductAttributesLine,
    formatPurchaseProductLabel,
    getProductDisplayName,
    getProductAttributeNames,
    getProductTitleAttributeNames,
    buildShowInTitleByTypeId,
    stripAttributesFromName,
    getProductPhotoId,
    type ProductLabelSource,
    type ProductAttributeValueSource,
    type AttributeTypeMeta,
    type ShowInTitleByTypeId,
} from './format-product-label';
export {
    buildDescriptionHtml,
    buildProductDescriptionText,
    productToDescriptionFields,
    applyPostTemplate,
    stripPlaceholderHintDebris,
    normalizeNovelHtml,
    POST_TEMPLATE_PLACEHOLDERS,
    type DescriptionFields,
} from './build-product-description';

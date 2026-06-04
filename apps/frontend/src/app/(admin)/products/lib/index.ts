export type { PathSegment, AttributeTypeRow, AttrProduct, TreeNode } from './types';
export { buildAttributeTree, collectExpandableIds, matchesPath } from './attribute-tree';
export {
    getAttributeCharacteristicIds,
    buildAttributesTreeByType,
    findAttributeDisplayName,
    groupAttributesByType,
    revokePendingFiles,
    type AttributeListItem,
    type AttributeBrandNode,
    type AttributesTreeForType,
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
    getProductCatalogAttributeLabels,
    formatProductCatalogCardLines,
    formatPurchaseProductLabel,
    buildShopItemDescriptionRows,
    type ShopItemDescriptionRow,
    getProductDisplayName,
    getProductAttributeNames,
    getProductTitleAttributeNames,
    buildShowInTitleByTypeId,
    stripAttributesFromName,
    getProductPhotoId,
    type ProductLabelSource,
    type ProductCatalogCardSource,
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

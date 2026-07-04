export type { PathSegment, AttributeTypeRow, AttrProduct, TreeNode } from './types';
export { buildAttributeTree, collectExpandableIds, matchesPath, productMatchesTreeNode } from './attribute-tree';
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
} from './product-form-utils';
export { productCreateSchema, productAttributeSchema, PACKAGE_UNITS } from './schema';
export type { PackageUnit, ProductCreateFormValues, ProductAttributeFormValues } from './schema';
export {
    formatProductAttributesLine,
    getProductCatalogAttributeLabels,
    formatProductCatalogCardLines,
    type CatalogCardLine,
    type CatalogCardLineRole,
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
} from './product-label';
export {
    buildDescriptionHtml,
    buildProductDescriptionText,
    productToDescriptionFields,
    applyPostTemplate,
    stripPlaceholderHintDebris,
    normalizeNovelHtml,
    POST_TEMPLATE_PLACEHOLDERS,
    type DescriptionFields,
    type ProductCharacteristicsCatalog,
} from './product-description';

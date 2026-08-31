export type ProductAttributeValueSource = {
    attribute: {
        name: string;
        isBrand?: boolean;
        showInTitle?: boolean;
        typeId?: number;
        parent?: { name: string; isBrand?: boolean } | null;
        type: { id?: number; name: string; position: number; showInTitle?: boolean };
    };
};

export type ShowInTitleByTypeId = Readonly<Record<number, boolean>>;

export type AttributeTypeMeta = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
    showInTitle?: boolean;
};

export type ProductCharacteristicValueSource = {
    value: string;
    characteristic: { name: string; position?: number };
};

export type ProductLabelSource = {
    name: string;
    articleNumber?: string | null;
    brand?: { name: string; typeId?: number; showInTitle?: boolean; isBrand?: boolean } | null;
    attributeValues?: ProductAttributeValueSource[];
    characteristicValues?: ProductCharacteristicValueSource[];
    photos?: { id: number }[];
};

export type ProductCatalogCardSource = ProductLabelSource & {
    unit?: { name: string; shortName: string } | null;
    minPackageAmount?: string | number | null;
    minPackageUnit?: string | null;
};

export type CatalogCardLineRole = 'title' | 'name' | 'meta';

export type CatalogCardLine = {
    text: string;
    role: CatalogCardLineRole;
};

export type ShopItemDescriptionRow = { label: string; value: string };

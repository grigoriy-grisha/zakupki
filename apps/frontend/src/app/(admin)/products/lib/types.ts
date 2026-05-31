export type PathSegment = {
    typeId: number;
    typeName: string;
    name: string;
    attributeId?: number;
    brandAttributeId?: number;
    isBrand?: boolean;
};

export type AttributeTypeRow = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
};

export type ProductAttributeRef = {
    id: number;
    name: string;
    typeId: number;
    isBrand?: boolean;
    parentId?: number | null;
    parent?: { id: number; name: string; isBrand?: boolean } | null;
};

export type AttrProduct = {
    id: number;
    brand?: { id: number; name: string; typeId?: number; isBrand?: boolean } | null;
    attributeValues?: { attribute: ProductAttributeRef }[];
};

export type TreeNode = {
    id: string;
    label: string;
    isTypeFolder: boolean;
    isBrandFolder?: boolean;
    typeId: number;
    count: number;
    path: PathSegment[];
    children: TreeNode[];
};

export type PathSegment = { typeId: number; typeName: string; name: string };

export type AttributeTypeRow = {
    id: number;
    name: string;
    parentId: number | null;
    position: number;
    showInTree: boolean;
};

export type AttrProduct = {
    id: number;
    attributeValues?: { attribute: { name: string; typeId: number } }[];
};

export type TreeNode = {
    id: string;
    /** Подпись в дереве: название типа или значение атрибута */
    label: string;
    /** Папка уровня типа (Производитель, Линейка…) — только раскрытие, без фильтра */
    isTypeFolder: boolean;
    typeId: number;
    count: number;
    path: PathSegment[];
    children: TreeNode[];
};

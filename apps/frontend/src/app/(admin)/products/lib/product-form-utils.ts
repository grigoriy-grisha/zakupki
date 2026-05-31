export type AttributeListItem = {
    id: number;
    typeId: number;
    name: string;
    characteristics?: { characteristic: { id: number } }[];
};

export type PendingFile = { id: string; file: File; preview: string };

export function getAttributeCharacteristicIds(attr: AttributeListItem | undefined): number[] {
    return attr?.characteristics?.map((l) => l.characteristic.id) ?? [];
}

export function revokePendingFiles(files: PendingFile[]) {
    for (const f of files) URL.revokeObjectURL(f.preview);
}

export function groupAttributesByType(
    items: AttributeListItem[] | undefined,
): Record<number, { id: number; name: string }[]> {
    const result: Record<number, { id: number; name: string }[]> = {};
    if (!items) return result;
    for (const item of items) {
        (result[item.typeId] ??= []).push({ id: item.id, name: item.name });
    }
    return result;
}

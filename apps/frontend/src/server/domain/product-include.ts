/**
 * Shared Prisma include для загрузки Product с полными связями.
 * Используется в ProductRepository и PurchaseRepository.
 */
export const productInclude = {
    photos: { select: { id: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const } },
    brand: { select: { id: true, name: true, typeId: true, showInTitle: true, isBrand: true } },
    attributeValues: {
        include: {
            attribute: {
                include: {
                    type: true,
                    parent: { select: { id: true, name: true, isBrand: true } },
                    characteristics: { include: { characteristic: true } },
                },
            },
        },
    },
    characteristicValues: {
        include: { characteristic: true },
        orderBy: [{ sortOrder: 'asc' as const }, { characteristicId: 'asc' as const }],
    },
};

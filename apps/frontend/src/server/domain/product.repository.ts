import { Prisma } from '@zakupki/database';
import type { PrismaClient } from '@zakupki/database';

import { assertProductNotInActivePurchase, findProductIdsInActivePurchases } from './product-purchase-lock';

export type PriceTier = { amount: number; unit: string; price: number };
export type ProductCharacteristicInput = { characteristicId: number; value: string };

export interface ProductWriteData {
    name?: string;
    articleNumber?: string | null;
    description?: string;
    unitId?: number;
    pricePerUnit?: number;
    attributeIds?: number[];
    characteristics?: ProductCharacteristicInput[];
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    priceTiers?: PriceTier[] | null;
    supplierPackageAmount?: number | null;
    supplierPackageUnit?: string | null;
    supplierPackagePrice?: number | null;
    availableAmount?: number | null;
    availableUnit?: string | null;
}

export interface ProductCreateData extends ProductWriteData {
    name: string;
    unitId: number;
    pricePerUnit: number;
}

export class ProductRepository {
    constructor(private db: PrismaClient) {}

    async list(search?: string) {
        return this.db.product.findMany({
            where: {
                ...(search
                    ? {
                          OR: [
                              { name: { contains: search, mode: 'insensitive' } },
                              { articleNumber: { contains: search, mode: 'insensitive' } },
                          ],
                      }
                    : {}),
            },
            include: productInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return this.db.product.findUnique({
            where: { id },
            include: productInclude,
        });
    }

    async create(data: ProductCreateData) {
        return this.db.product.create({
            data: toPrismaCreate(data),
            include: productInclude,
        });
    }

    async update(id: number, data: ProductWriteData) {
        return this.db.product.update({
            where: { id },
            data: toPrismaUpdate(data),
            include: productInclude,
        });
    }

    async assertNotInActivePurchase(id: number) {
        return assertProductNotInActivePurchase(this.db, id);
    }

    async findProductIdsInActivePurchases(productIds: number[]) {
        return findProductIdsInActivePurchases(this.db, productIds);
    }

    async delete(id: number) {
        return this.db.$transaction(async (tx) => {
            const purchaseItems = await tx.purchaseItem.findMany({
                where: { productId: id },
                select: { id: true },
            });
            const purchaseItemIds = purchaseItems.map((item) => item.id);
            if (purchaseItemIds.length > 0) {
                await tx.orderLine.deleteMany({ where: { purchaseItemId: { in: purchaseItemIds } } });
                await tx.purchaseItem.deleteMany({ where: { productId: id } });
            }
            return tx.product.delete({ where: { id } });
        });
    }

    async addPhoto(productId: number, data: Uint8Array, mimeType: string, sortOrder: number) {
        return this.db.productPhoto.create({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            data: { productId, data: data as any, mimeType, sortOrder },
        });
    }

    async getPhoto(id: number) {
        return this.db.productPhoto.findUnique({ where: { id } });
    }

    async deletePhoto(id: number) {
        return this.db.productPhoto.delete({ where: { id } });
    }

    async getPhotosByProduct(productId: number) {
        return this.db.productPhoto.findMany({
            where: { productId },
            orderBy: { sortOrder: 'asc' },
        });
    }
}

const productInclude = {
    photos: { select: { id: true, sortOrder: true } },
    unit: true,
    attributeValues: {
        include: {
            attribute: {
                include: {
                    type: true,
                    characteristics: { include: { characteristic: true } },
                },
            },
        },
    },
    characteristicValues: { include: { characteristic: true }, orderBy: { characteristic: { position: 'asc' } } },
} as const;

function toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
    const { unitId, priceTiers, attributeIds, characteristics, ...rest } = data;
    return {
        ...rest,
        priceTiers: priceTiers ?? Prisma.JsonNull,
        unit: { connect: { id: unitId } },
        ...(attributeIds && attributeIds.length > 0
            ? { attributeValues: { create: attributeIds.map((id) => ({ attribute: { connect: { id } } })) } }
            : {}),
        ...characteristicValuesCreate(characteristics),
    };
}

function toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
    const { unitId, priceTiers, attributeIds, characteristics, ...rest } = data;
    const update: Prisma.ProductUpdateInput = { ...rest };
    if (priceTiers !== undefined) {
        update.priceTiers = priceTiers ?? Prisma.JsonNull;
    }
    if (unitId !== undefined) {
        update.unit = { connect: { id: unitId } };
    }
    if (attributeIds !== undefined) {
        update.attributeValues = {
            deleteMany: {},
            create: attributeIds.map((id) => ({ attribute: { connect: { id } } })),
        };
    }
    if (characteristics !== undefined) {
        update.characteristicValues = {
            deleteMany: {},
            create: characteristics
                .filter((c) => c.value.trim())
                .map((c) => ({ characteristicId: c.characteristicId, value: c.value.trim() })),
        };
    }
    return update;
}

function characteristicValuesCreate(
    characteristics: ProductCharacteristicInput[] | undefined,
): Pick<Prisma.ProductCreateInput, 'characteristicValues'> {
    if (!characteristics?.length) return {};
    const rows = characteristics.filter((c) => c.value.trim()).map((c) => ({
        characteristicId: c.characteristicId,
        value: c.value.trim(),
    }));
    if (!rows.length) return {};
    return { characteristicValues: { create: rows } };
}

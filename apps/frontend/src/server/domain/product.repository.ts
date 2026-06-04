import { Prisma, dbClient } from '@zakupki/database';

import { storage } from '@/lib/server/storage';
import { assertProductNotInActivePurchase, findProductIdsInActivePurchases } from './product-purchase-lock';

export type PriceTier = { amount: number; unit: string; price: number };
export type ProductCharacteristicInput = { characteristicId: number; value: string; sortOrder?: number };

export interface ProductWriteData {
    name?: string;
    articleNumber?: string | null;
    brandId?: number | null;
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
    supplierPackageTiers?: PriceTier[] | null;
    availableAmount?: number | null;
    availableUnit?: string | null;
}

export interface ProductCreateData extends ProductWriteData {
    name: string;
    unitId: number;
    pricePerUnit: number;
}

export class ProductRepository {
    constructor() {}

    async list(search?: string) {
        return dbClient.product.findMany({
            where: {
                ...(search
                    ? {
                          OR: [
                              { name: { contains: search, mode: 'insensitive' } },
                              { articleNumber: { contains: search, mode: 'insensitive' } },
                              { brand: { name: { contains: search, mode: 'insensitive' } } },
                          ],
                      }
                    : {}),
            },
            include: productInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return dbClient.product.findUnique({
            where: { id },
            include: productInclude,
        });
    }

    async create(data: ProductCreateData) {
        const resolved = await resolveBrandFromAttributeIds(data.attributeIds, data.brandId);
        return dbClient.product.create({
            data: toPrismaCreate({ ...data, ...resolved }),
            include: productInclude,
        });
    }

    async update(id: number, data: ProductWriteData) {
        const { attributeIds, characteristics, brandId, ...rest } = data;
        const resolved = await resolveBrandFromAttributeIds(attributeIds, brandId);

        return dbClient.$transaction(async (tx) => {
            if (attributeIds !== undefined) {
                await tx.productAttributeValue.deleteMany({ where: { productId: id } });
                if (attributeIds.length > 0) {
                    await tx.productAttributeValue.createMany({
                        data: attributeIds.map((attributeId) => ({ productId: id, attributeId })),
                    });
                }
            }

            if (characteristics !== undefined) {
                await tx.productCharacteristicValue.deleteMany({ where: { productId: id } });
                const rows = characteristics
                    .filter((c) => c.value.trim())
                    .map((c, index) => ({
                        productId: id,
                        characteristicId: c.characteristicId,
                        value: c.value.trim(),
                        sortOrder: c.sortOrder ?? index,
                    }));
                if (rows.length > 0) {
                    await tx.productCharacteristicValue.createMany({ data: rows });
                }
            }

            const updateData = toPrismaUpdate({
                ...rest,
                ...(attributeIds !== undefined ? { brandId: resolved.brandId } : {}),
                ...(attributeIds === undefined && brandId !== undefined ? { brandId } : {}),
            });

            return tx.product.update({
                where: { id },
                data: updateData,
                include: productInclude,
            });
        });
    }

    async assertNotInActivePurchase(id: number) {
        return assertProductNotInActivePurchase(dbClient, id);
    }

    async findProductIdsInActivePurchases(productIds: number[]) {
        return findProductIdsInActivePurchases(dbClient, productIds);
    }

    async delete(id: number) {
        return dbClient.$transaction(async (tx) => {
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

    async addPhoto(productId: number, objectKey: string, mimeType: string, sortOrder: number) {
        return dbClient.productPhoto.create({
            data: { productId, objectKey, mimeType, sortOrder },
        });
    }

    async getPhoto(id: number) {
        return dbClient.productPhoto.findUnique({ where: { id } });
    }

    async deletePhoto(id: number) {
        await storage.delete(id);
    }

    async getPhotosByProduct(productId: number) {
        return dbClient.productPhoto.findMany({
            where: { productId },
            orderBy: { sortOrder: 'asc' },
        });
    }
}

const productInclude = {
    photos: { select: { id: true, sortOrder: true }, orderBy: { sortOrder: 'asc' as const } },
    unit: true,
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

function toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
    const { unitId, priceTiers, supplierPackageTiers, attributeIds, characteristics, brandId, ...rest } = data;
    return {
        ...rest,
        priceTiers: priceTiers ?? Prisma.JsonNull,
        supplierPackageTiers: supplierPackageTiers ?? Prisma.JsonNull,
        unit: { connect: { id: unitId } },
        ...(brandId != null ? { brand: { connect: { id: brandId } } } : {}),
        ...(attributeIds && attributeIds.length > 0
            ? { attributeValues: { create: attributeIds.map((id) => ({ attribute: { connect: { id } } })) } }
            : {}),
        ...characteristicValuesCreate(characteristics),
    };
}

function toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
    const {
        unitId,
        priceTiers,
        supplierPackageTiers,
        brandId,
        attributeIds: _attributeIds,
        characteristics: _characteristics,
        ...rest
    } = data;
    const update: Prisma.ProductUpdateInput = { ...rest };
    if (priceTiers !== undefined) {
        update.priceTiers = priceTiers ?? Prisma.JsonNull;
    }
    if (supplierPackageTiers !== undefined) {
        update.supplierPackageTiers = supplierPackageTiers ?? Prisma.JsonNull;
    }
    if (unitId !== undefined) {
        update.unit = { connect: { id: unitId } };
    }
    if (brandId !== undefined) {
        update.brand = brandId == null ? { disconnect: true } : { connect: { id: brandId } };
    }
    return update;
}

async function resolveBrandFromAttributeIds(
    attributeIds: number[] | undefined,
    brandId: number | null | undefined,
): Promise<{ brandId?: number | null; attributeIds?: number[] }> {
    if (attributeIds === undefined) {
        return brandId !== undefined ? { brandId } : {};
    }
    if (attributeIds.length === 0) {
        return { brandId: brandId ?? null, attributeIds };
    }
    const attrs = await dbClient.productAttribute.findMany({
        where: { id: { in: attributeIds } },
        select: { id: true, isBrand: true },
    });
    const brand = attrs.find((a) => a.isBrand);
    return {
        brandId: brandId !== undefined ? brandId : (brand?.id ?? null),
        attributeIds,
    };
}

function characteristicValuesCreate(
    characteristics: ProductCharacteristicInput[] | undefined,
): Pick<Prisma.ProductCreateInput, 'characteristicValues'> {
    if (!characteristics?.length) return { characteristicValues: undefined };
    const rows = characteristics
        .filter((c) => c.value.trim())
        .map((c, index) => ({
            characteristicId: c.characteristicId,
            value: c.value.trim(),
            sortOrder: c.sortOrder ?? index,
        }));
    if (!rows.length) return { characteristicValues: undefined };
    return { characteristicValues: { create: rows } };
}

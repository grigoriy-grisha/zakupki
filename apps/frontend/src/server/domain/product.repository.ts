import { Prisma, dbClient } from '@zakupki/database';

import { storage } from '@/lib/server/storage';
import { productInclude } from './product-include';
import { assertProductNotInActivePurchase, findProductIdsInActivePurchases } from './product-purchase-lock';

export type ProductCharacteristicInput = { characteristicId: number; value: string; sortOrder?: number };

export interface ProductWriteData {
    name?: string;
    articleNumber?: string | null;
    brandId?: number | null;
    unitCode?: string;
    multiplicity?: number;
    attributeIds?: number[];
    characteristics?: ProductCharacteristicInput[];
}

export interface ProductCreateData extends ProductWriteData {
    name: string;
    unitCode: string;
    multiplicity?: number;
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

    /** Возвращает продукты с флагом inActivePurchase для UI. */
    async listWithPurchaseFlag(search?: string) {
        const products = await this.list(search);
        const lockedIds = await findProductIdsInActivePurchases(
            dbClient,
            products.map((p) => p.id),
        );
        return products.map((p) => ({ ...p, inActivePurchase: lockedIds.has(p.id) }));
    }

    async getById(id: number) {
        return dbClient.product.findUnique({
            where: { id },
            include: productInclude,
        });
    }

    /** Возвращает продукт с флагом inActivePurchase, бросает NotFoundError если не найден. */
    async getByIdOrThrow(id: number) {
        const product = await this.getById(id);
        if (!product) return null;
        const lockedIds = await findProductIdsInActivePurchases(dbClient, [id]);
        return { ...product, inActivePurchase: lockedIds.has(id) };
    }

    async create(data: ProductCreateData) {
        const resolved = await resolveBrandFromAttributeIds(data.attributeIds, data.brandId);
        return dbClient.product.create({
            data: toPrismaCreate({ ...data, ...resolved }),
            include: productInclude,
        });
    }

    async update(id: number, data: ProductWriteData) {
        const { attributeIds, characteristics, ...rest } = data;

        // Определяем brandId: если переданы attributeIds — резолвим бренд из них,
        // иначе используем явно переданный brandId из rest
        const resolved = await resolveBrandFromAttributeIds(attributeIds, rest.brandId);

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
                brandId: resolved.brandId,
            });

            return tx.product.update({
                where: { id },
                data: { ...updateData, version: { increment: 1 } },
                include: productInclude,
            });
        });
    }

    async updateWithVersionCheck(id: number, data: ProductWriteData, expectedVersion: number) {
        const { attributeIds, characteristics, ...rest } = data;
        const resolved = await resolveBrandFromAttributeIds(attributeIds, rest.brandId);

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
                brandId: resolved.brandId,
            });

            const updated = await tx.product.updateMany({
                where: { id, version: expectedVersion },
                data: { ...updateData, version: { increment: 1 } },
            });

            if (updated.count === 0) return null;

            return tx.product.findUnique({
                where: { id },
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
        const photo = await dbClient.productPhoto.findUnique({ where: { id } });
        if (!photo) return;
        await dbClient.productPhoto.delete({ where: { id } });
        await storage.delete(id);
    }

    async getPhotosByProduct(productId: number) {
        return dbClient.productPhoto.findMany({
            where: { productId },
            orderBy: { sortOrder: 'asc' },
        });
    }
}

function toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
    const { attributeIds, characteristics, brandId, ...rest } = data;
    return {
        ...rest,
        multiplicity: data.multiplicity ?? 1,
        ...(brandId != null ? { brand: { connect: { id: brandId } } } : {}),
        ...(attributeIds && attributeIds.length > 0
            ? { attributeValues: { create: attributeIds.map((id) => ({ attribute: { connect: { id } } })) } }
            : {}),
        ...characteristicValuesCreate(characteristics),
    };
}

function toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
    const { brandId, attributeIds: _attributeIds, characteristics: _characteristics, ...rest } = data;
    const update: Prisma.ProductUpdateInput = { ...rest };
    if (brandId !== undefined) {
        update.brand = brandId == null ? { disconnect: true } : { connect: { id: brandId } };
    }
    return update;
}

/**
 * Определяет brandId на основе attributeIds.
 * - Если attributeIds не переданы — brandId не меняется (используется только явный brandId)
 * - Если attributeIds переданы (даже пустые) — бренд резолвится из атрибутов
 * - Если brandId уже задан явно — пропускает DB-запрос
 */
async function resolveBrandFromAttributeIds(
    attributeIds: number[] | undefined,
    brandId: number | null | undefined,
): Promise<{ brandId?: number | null }> {
    // attributeIds не переданы — не трогаем brand
    if (attributeIds === undefined) {
        return brandId !== undefined ? { brandId } : {};
    }

    // brandId задан явно — не нужен DB-запрос
    if (brandId !== undefined) {
        return { brandId };
    }

    // Пустые attributeIds — очищаем бренд
    if (attributeIds.length === 0) {
        return { brandId: null };
    }

    // Ищем isBrand среди переданных attributeIds
    const attrs = await dbClient.productAttribute.findMany({
        where: { id: { in: attributeIds } },
        select: { id: true, isBrand: true },
    });
    const brand = attrs.find((a) => a.isBrand);
    return { brandId: brand?.id ?? null };
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

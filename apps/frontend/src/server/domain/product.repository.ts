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

    async getByIdOrThrow(id: number) {
        const product = await this.getById(id);
        if (!product) return null;
        const lockedIds = await findProductIdsInActivePurchases(dbClient, [id]);
        return { ...product, inActivePurchase: lockedIds.has(id) };
    }

    async create(data: ProductCreateData) {
        const resolved = await this.resolveBrandFromAttributeIds(data.attributeIds, data.brandId);
        return dbClient.product.create({
            data: this.toPrismaCreate({ ...data, ...resolved }),
            include: productInclude,
        });
    }

    async update(id: number, data: ProductWriteData) {
        const resolved = await this.resolveBrandFromAttributeIds(data.attributeIds, data.brandId);

        return dbClient.$transaction(async (tx) => {
            await this.replaceProductRelations(tx, id, data.attributeIds, data.characteristics);
            return tx.product.update({
                where: { id },
                data: this.buildVersionedUpdateData(data, resolved.brandId),
                include: productInclude,
            });
        });
    }

    async updateWithVersionCheck(id: number, data: ProductWriteData, expectedVersion: number) {
        const resolved = await this.resolveBrandFromAttributeIds(data.attributeIds, data.brandId);

        return dbClient.$transaction(async (tx) => {
            await this.replaceProductRelations(tx, id, data.attributeIds, data.characteristics);

            const updated = await tx.product.updateMany({
                where: { id, version: expectedVersion },
                data: this.buildVersionedUpdateData(data, resolved.brandId),
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

    private buildVersionedUpdateData(
        data: ProductWriteData,
        brandId: number | null | undefined,
): Prisma.ProductUpdateInput {
        const { attributeIds: _attributeIds, characteristics: _characteristics, ...rest } = data;
        return { ...this.toPrismaUpdate({ ...rest, brandId }), version: { increment: 1 } };
    }

    private async replaceProductRelations(
        tx: Prisma.TransactionClient,
        id: number,
        attributeIds: number[] | undefined,
        characteristics: ProductCharacteristicInput[] | undefined,
    ): Promise<void> {
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
    }

    private toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
        const { attributeIds, characteristics, brandId, ...rest } = data;
        return {
            ...rest,
            multiplicity: data.multiplicity ?? 1,
            ...(brandId != null ? { brand: { connect: { id: brandId } } } : {}),
            ...(attributeIds && attributeIds.length > 0
                ? { attributeValues: { create: attributeIds.map((id) => ({ attribute: { connect: { id } } })) } }
                : {}),
            ...this.characteristicValuesCreate(characteristics),
        };
    }

    private toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
        const { brandId, attributeIds: _attributeIds, characteristics: _characteristics, ...rest } = data;
        const update: Prisma.ProductUpdateInput = { ...rest };
        if (brandId !== undefined) {
            update.brand = brandId == null ? { disconnect: true } : { connect: { id: brandId } };
        }
        return update;
    }

    private async resolveBrandFromAttributeIds(
        attributeIds: number[] | undefined,
        brandId: number | null | undefined,
    ): Promise<{ brandId?: number | null }> {
        if (attributeIds === undefined) {
            return brandId !== undefined ? { brandId } : {};
        }

        if (brandId !== undefined) {
            return { brandId };
        }

        if (attributeIds.length === 0) {
            return { brandId: null };
        }

        const attrs = await dbClient.productAttribute.findMany({
            where: { id: { in: attributeIds } },
            select: { id: true, isBrand: true, parentId: true },
        });
        const directBrand = attrs.find((a) => a.isBrand);
        if (directBrand) return { brandId: directBrand.id };

        let frontier = [...new Set(attrs.map((a) => a.parentId).filter((id): id is number => id != null))];
        const visited = new Set<number>();
        while (frontier.length > 0) {
            const parents = await dbClient.productAttribute.findMany({
                where: { id: { in: frontier.filter((id) => !visited.has(id)) } },
                select: { id: true, isBrand: true, parentId: true },
            });
            const parentBrand = parents.find((p) => p.isBrand);
            if (parentBrand) return { brandId: parentBrand.id };
            for (const p of parents) visited.add(p.id);
            frontier = [...new Set(parents.map((p) => p.parentId).filter((id): id is number => id != null))];
        }
        return { brandId: null };
    }

    private characteristicValuesCreate(
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
}

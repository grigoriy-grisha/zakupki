import { Prisma } from '@zakupki/database';
import type { PrismaClient } from '@zakupki/database';

export type PriceTier = { amount: number; unit: string; price: number };

export interface ProductWriteData {
    name?: string;
    description?: string;
    unitId?: number;
    pricePerUnit?: number;
    categoryId?: number | null;
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

    async list(search?: string, categoryId?: number | null) {
        return this.db.product.findMany({
            where: {
                ...(search
                    ? {
                          OR: [
                              { name: { contains: search, mode: 'insensitive' } },
                          ],
                      }
                    : {}),
                ...(categoryId != null ? { categoryId } : {}),
            },
            include: { photos: { select: { id: true, sortOrder: true } }, unit: true, category: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getById(id: number) {
        return this.db.product.findUnique({
            where: { id },
            include: { photos: { select: { id: true, sortOrder: true } }, unit: true },
        });
    }

    async create(data: ProductCreateData) {
        return this.db.product.create({
            data: toPrismaCreate(data),
            include: { unit: true, category: true },
        });
    }

    async update(id: number, data: ProductWriteData) {
        return this.db.product.update({
            where: { id },
            data: toPrismaUpdate(data),
            include: { unit: true, category: true },
        });
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

function toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
    const { categoryId, unitId, priceTiers, ...rest } = data;
    return {
        ...rest,
        priceTiers: priceTiers ?? Prisma.JsonNull,
        unit: { connect: { id: unitId } },
        ...(categoryId != null ? { category: { connect: { id: categoryId } } } : {}),
    };
}

function toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
    const { categoryId, unitId, priceTiers, ...rest } = data;
    const update: Prisma.ProductUpdateInput = { ...rest };
    if (priceTiers !== undefined) {
        update.priceTiers = priceTiers ?? Prisma.JsonNull;
    }
    if (unitId !== undefined) {
        update.unit = { connect: { id: unitId } };
    }
    if (categoryId !== undefined) {
        update.category = categoryId == null ? { disconnect: true } : { connect: { id: categoryId } };
    }
    return update;
}

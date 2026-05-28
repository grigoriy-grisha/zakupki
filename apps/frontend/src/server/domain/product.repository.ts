import { Prisma } from '@zakupki/database';
import type { PrismaClient } from '@zakupki/database';

import { assertProductNotInActivePurchase, findProductIdsInActivePurchases } from './product-purchase-lock';

export type PriceTier = { amount: number; unit: string; price: number };

export interface ProductWriteData {
    name?: string;
    articleNumber?: string | null;
    description?: string;
    unitId?: number;
    pricePerUnit?: number;
    categoryId?: number | null;
    manufacturerId?: number | null;
    sizeId?: number | null;
    formId?: number | null;
    productLineId?: number | null;
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
                              { articleNumber: { contains: search, mode: 'insensitive' } },
                              { manufacturer: { name: { contains: search, mode: 'insensitive' } } },
                              { size: { name: { contains: search, mode: 'insensitive' } } },
                              { form: { name: { contains: search, mode: 'insensitive' } } },
                              { productLine: { name: { contains: search, mode: 'insensitive' } } },
                          ],
                      }
                    : {}),
                ...(categoryId != null ? { categoryId } : {}),
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
    category: true,
    manufacturer: true,
    size: true,
    form: true,
    productLine: true,
} as const;

function toPrismaCreate(data: ProductCreateData): Prisma.ProductCreateInput {
    const { categoryId, unitId, priceTiers, manufacturerId, sizeId, formId, productLineId, ...rest } = data;
    return {
        ...rest,
        priceTiers: priceTiers ?? Prisma.JsonNull,
        unit: { connect: { id: unitId } },
        ...optionalRelation('category', categoryId),
        ...optionalRelation('manufacturer', manufacturerId),
        ...optionalRelation('size', sizeId),
        ...optionalRelation('form', formId),
        ...optionalRelation('productLine', productLineId),
    };
}

function toPrismaUpdate(data: ProductWriteData): Prisma.ProductUpdateInput {
    const { categoryId, unitId, priceTiers, manufacturerId, sizeId, formId, productLineId, ...rest } = data;
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
    if (manufacturerId !== undefined) {
        update.manufacturer =
            manufacturerId == null ? { disconnect: true } : { connect: { id: manufacturerId } };
    }
    if (sizeId !== undefined) {
        update.size = sizeId == null ? { disconnect: true } : { connect: { id: sizeId } };
    }
    if (formId !== undefined) {
        update.form = formId == null ? { disconnect: true } : { connect: { id: formId } };
    }
    if (productLineId !== undefined) {
        update.productLine =
            productLineId == null ? { disconnect: true } : { connect: { id: productLineId } };
    }
    return update;
}

function optionalRelation(
    field: 'category' | 'manufacturer' | 'size' | 'form' | 'productLine',
    id: number | null | undefined,
): Pick<Prisma.ProductCreateInput, 'category' | 'manufacturer' | 'size' | 'form' | 'productLine'> {
    if (id == null) return {};
    return { [field]: { connect: { id } } } as Pick<
        Prisma.ProductCreateInput,
        'category' | 'manufacturer' | 'size' | 'form' | 'productLine'
    >;
}

import type { PrismaClient } from '@zakupki/database';

export class ProductRepository {
    constructor(private db: PrismaClient) {}

    async list(search?: string, categoryId?: number | null) {
        return this.db.product.findMany({
            where: {
                ...(search
                    ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }] }
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

    async create(data: {
        name: string;
        description?: string;
        unitId: number;
        pricePerUnit: number;
        brand?: string;
        sku?: string;
        categoryId?: number | null;
    }) {
        const { categoryId, ...rest } = data;
        return this.db.product.create({
            data: { ...rest, categoryId: categoryId ?? null },
            include: { unit: true, category: true },
        });
    }

    async update(
        id: number,
        data: {
            name?: string;
            description?: string;
            unitId?: number;
            pricePerUnit?: number;
            brand?: string;
            sku?: string;
            categoryId?: number | null;
        },
    ) {
        return this.db.product.update({ where: { id }, data, include: { unit: true, category: true } });
    }

    async delete(id: number) {
        return this.db.product.delete({ where: { id } });
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

import { ProductRepository, type ProductCreateData, type ProductWriteData } from '../domain/product.repository';

export class ProductService {
    constructor(private repo: ProductRepository) {}

    async list(search?: string, categoryId?: number | null) {
        const products = await this.repo.list(search, categoryId);
        const lockedIds = await this.repo.findProductIdsInActivePurchases(products.map((p) => p.id));
        return products.map((p) => ({ ...p, inActivePurchase: lockedIds.has(p.id) }));
    }

    async getById(id: number) {
        const product = await this.repo.getById(id);
        if (!product) throw new Error('Product not found');
        const lockedIds = await this.repo.findProductIdsInActivePurchases([id]);
        return { ...product, inActivePurchase: lockedIds.has(id) };
    }

    async create(data: ProductCreateData) {
        return this.repo.create(data);
    }

    async update(id: number, data: ProductWriteData) {
        return this.repo.update(id, data);
    }

    async delete(id: number) {
        await this.repo.assertNotInActivePurchase(id);
        return this.repo.delete(id);
    }

    async addPhoto(productId: number, data: Uint8Array, mimeType: string, sortOrder: number) {
        return this.repo.addPhoto(productId, data, mimeType, sortOrder);
    }

    async getPhoto(id: number) {
        return this.repo.getPhoto(id);
    }

    async deletePhoto(id: number) {
        return this.repo.deletePhoto(id);
    }
}

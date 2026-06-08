import { NotFoundError } from '@zakupki/types';

import { ProductRepository, type ProductCreateData, type ProductWriteData } from '../domain/product.repository';

export class ProductService {
    constructor(private repo: ProductRepository) {}

    async list(search?: string) {
        return this.repo.listWithPurchaseFlag(search);
    }

    async getById(id: number) {
        const product = await this.repo.getByIdOrThrow(id);
        if (!product) throw new NotFoundError('Товар', id);
        return product;
    }

    async create(data: ProductCreateData) {
        return this.repo.create(data);
    }

    async update(id: number, data: ProductWriteData) {
        return this.repo.update(id, data);
    }

    async updateWithVersionCheck(id: number, data: ProductWriteData, expectedVersion: number) {
        return this.repo.updateWithVersionCheck(id, data, expectedVersion);
    }

    async delete(id: number) {
        await this.repo.assertNotInActivePurchase(id);
        return this.repo.delete(id);
    }

    async addPhoto(productId: number, objectKey: string, mimeType: string, sortOrder: number) {
        return this.repo.addPhoto(productId, objectKey, mimeType, sortOrder);
    }

    async getPhoto(id: number) {
        return this.repo.getPhoto(id);
    }

    async deletePhoto(id: number) {
        return this.repo.deletePhoto(id);
    }
}

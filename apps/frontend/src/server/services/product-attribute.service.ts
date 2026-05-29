import { ProductAttributeRepository } from '../domain/product-attribute.repository';

export class ProductAttributeService {
    constructor(private repo: ProductAttributeRepository) {}

    list(typeId?: number) {
        return this.repo.list(typeId);
    }

    create(data: { typeId: number; name: string; characteristicIds?: number[] }) {
        return this.repo.create(data);
    }

    update(id: number, data: { name?: string; characteristicIds?: number[] }) {
        return this.repo.update(id, data);
    }

    delete(id: number) {
        return this.repo.delete(id);
    }
}

import type { ProductAttributeKind } from '@zakupki/database';
import { ProductAttributeRepository } from '../domain/product-attribute.repository';

export class ProductAttributeService {
    constructor(private repo: ProductAttributeRepository) {}

    list(kind?: ProductAttributeKind) {
        return this.repo.list(kind);
    }

    create(data: { kind: ProductAttributeKind; name: string }) {
        return this.repo.create(data);
    }

    update(id: number, data: { name?: string }) {
        return this.repo.update(id, data);
    }

    delete(id: number) {
        return this.repo.delete(id);
    }
}

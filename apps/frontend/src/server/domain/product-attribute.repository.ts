import type { PrismaClient, ProductAttributeKind } from '@zakupki/database';

export class ProductAttributeRepository {
    constructor(private db: PrismaClient) {}

    async list(kind?: ProductAttributeKind) {
        return this.db.productAttribute.findMany({
            where: kind ? { kind } : undefined,
            orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        });
    }

    async create(data: { kind: ProductAttributeKind; name: string }) {
        return this.db.productAttribute.create({ data });
    }

    async update(id: number, data: { name?: string }) {
        return this.db.productAttribute.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.productAttribute.delete({ where: { id } });
    }
}

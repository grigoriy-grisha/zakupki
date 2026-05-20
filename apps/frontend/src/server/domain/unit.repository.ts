import type { PrismaClient } from '@zakupki/database';

export class UnitRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.unit.findMany({ orderBy: { createdAt: 'asc' } });
    }

    async getById(id: number) {
        return this.db.unit.findUnique({ where: { id } });
    }

    async create(data: { name: string; shortName: string; multiplicity: number }) {
        return this.db.unit.create({ data });
    }

    async update(id: number, data: { name?: string; shortName?: string; multiplicity?: number }) {
        return this.db.unit.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.unit.delete({ where: { id } });
    }

    async hasProducts(id: number) {
        const count = await this.db.product.count({ where: { unitId: id } });
        return count > 0;
    }
}

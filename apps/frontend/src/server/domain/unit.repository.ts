import { dbClient } from '@zakupki/database';

export class UnitRepository {
    constructor() {}

    async list() {
        return dbClient.unit.findMany({ orderBy: { createdAt: 'asc' } });
    }

    async getById(id: number) {
        return dbClient.unit.findUnique({ where: { id } });
    }

    async create(data: { name: string; shortName: string; multiplicity: number }) {
        return dbClient.unit.create({ data });
    }

    async update(id: number, data: { name?: string; shortName?: string; multiplicity?: number }) {
        return dbClient.unit.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.unit.delete({ where: { id } });
    }

    async hasProducts(id: number) {
        const count = await dbClient.product.count({ where: { unitId: id } });
        return count > 0;
    }
}

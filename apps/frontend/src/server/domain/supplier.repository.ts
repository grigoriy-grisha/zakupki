import { dbClient } from '@zakupki/database';

export class SupplierRepository {
    constructor() {}

    async list() {
        return dbClient.supplier.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    }

    async create(data: { name: string }) {
        return dbClient.supplier.create({ data: { name: data.name } });
    }

    async update(id: number, data: { name?: string }) {
        return dbClient.supplier.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.supplier.delete({ where: { id } });
    }
}


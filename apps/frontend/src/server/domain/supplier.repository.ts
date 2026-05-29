import type { PrismaClient } from '@zakupki/database';

export class SupplierRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.supplier.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    }

    async create(data: { name: string }) {
        return this.db.supplier.create({ data: { name: data.name } });
    }

    async update(id: number, data: { name?: string }) {
        return this.db.supplier.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.supplier.delete({ where: { id } });
    }
}


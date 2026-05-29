import type { PrismaClient } from '@zakupki/database';

export class CharacteristicRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.characteristic.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { name: string }) {
        const last = await this.db.characteristic.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return this.db.characteristic.create({ data: { name: data.name, position } });
    }

    async update(id: number, data: { name?: string }) {
        return this.db.characteristic.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.characteristic.delete({ where: { id } });
    }
}

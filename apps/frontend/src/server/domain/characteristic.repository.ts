import { dbClient } from '@zakupki/database';

export class CharacteristicRepository {
    constructor() {}

    async list() {
        return dbClient.characteristic.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { name: string }) {
        const last = await dbClient.characteristic.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return dbClient.characteristic.create({ data: { name: data.name, position } });
    }

    async update(id: number, data: { name?: string }) {
        return dbClient.characteristic.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.characteristic.delete({ where: { id } });
    }

    async swapPositions(id: number, otherId: number) {
        const [a, b] = await Promise.all([
            dbClient.characteristic.findUnique({ where: { id } }),
            dbClient.characteristic.findUnique({ where: { id: otherId } }),
        ]);
        if (!a || !b) return;
        await dbClient.$transaction([
            dbClient.characteristic.update({ where: { id: a.id }, data: { position: b.position } }),
            dbClient.characteristic.update({ where: { id: b.id }, data: { position: a.position } }),
        ]);
    }
}

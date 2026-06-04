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
}

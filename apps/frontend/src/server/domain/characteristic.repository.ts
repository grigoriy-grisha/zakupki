import { dbClient } from '@zakupki/database';
import { getNextPosition } from '../lib/get-next-position';

export class CharacteristicRepository {
    async list() {
        return dbClient.characteristic.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { name: string }) {
        const position = await getNextPosition((args) => dbClient.characteristic.findFirst(args));
        return dbClient.characteristic.create({ data: { name: data.name, position } });
    }

    async update(id: number, data: { name?: string }) {
        return dbClient.characteristic.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.characteristic.delete({ where: { id } });
    }
}

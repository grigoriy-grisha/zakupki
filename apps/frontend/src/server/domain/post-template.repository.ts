import { dbClient } from '@zakupki/database';

export class PostTemplateRepository {
    constructor() {}

    async list() {
        return dbClient.postTemplate.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async findById(id: number) {
        return dbClient.postTemplate.findUnique({ where: { id } });
    }

    async create(data: { name: string; body?: string }) {
        const last = await dbClient.postTemplate.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return dbClient.postTemplate.create({
            data: { name: data.name, body: data.body ?? '', position },
        });
    }

    async update(id: number, data: { name?: string; body?: string }) {
        return dbClient.postTemplate.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.postTemplate.delete({ where: { id } });
    }
}

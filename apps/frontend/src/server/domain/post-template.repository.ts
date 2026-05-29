import type { PrismaClient } from '@zakupki/database';

export class PostTemplateRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.postTemplate.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { name: string; body?: string }) {
        const last = await this.db.postTemplate.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return this.db.postTemplate.create({
            data: { name: data.name, body: data.body ?? '', position },
        });
    }

    async update(id: number, data: { name?: string; body?: string }) {
        return this.db.postTemplate.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.postTemplate.delete({ where: { id } });
    }
}

import type { PrismaClient } from '@zakupki/database';

export class CategoryRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.category.findMany({
            include: { children: { include: { children: true } } },
            where: { parentId: null },
            orderBy: { name: 'asc' },
        });
    }

    async getAll() {
        return this.db.category.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async getById(id: number) {
        return this.db.category.findUnique({
            where: { id },
            include: { children: true, parent: true },
        });
    }

    async create(data: { name: string; parentId?: number | null }) {
        return this.db.category.create({
            data: { name: data.name, parentId: data.parentId ?? null },
        });
    }

    async update(id: number, data: { name?: string; parentId?: number | null }) {
        return this.db.category.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.category.delete({ where: { id } });
    }
}

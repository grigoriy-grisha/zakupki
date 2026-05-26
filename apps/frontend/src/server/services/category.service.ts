import { CategoryRepository } from '../domain/category.repository';

export class CategoryService {
    constructor(private repo: CategoryRepository) {}

    async getTree() {
        return this.repo.list();
    }

    async getAll() {
        return this.repo.getAll();
    }

    async getById(id: number) {
        return this.repo.getById(id);
    }

    async create(data: { name: string; parentId?: number | null }) {
        return this.repo.create(data);
    }

    async update(id: number, data: { name?: string; parentId?: number | null }) {
        return this.repo.update(id, data);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }
}

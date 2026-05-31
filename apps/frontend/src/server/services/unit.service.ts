import { NotFoundError, ValidationError } from '@zakupki/types';

import { UnitRepository } from '../domain/unit.repository';

export class UnitService {
    constructor(private repo: UnitRepository) {}

    async list() {
        return this.repo.list();
    }

    async getById(id: number) {
        const unit = await this.repo.getById(id);
        if (!unit) throw new NotFoundError('Единица измерения', id);
        return unit;
    }

    async create(data: { name: string; shortName: string; multiplicity: number }) {
        return this.repo.create(data);
    }

    async update(id: number, data: { name?: string; shortName?: string; multiplicity?: number }) {
        return this.repo.update(id, data);
    }

    async delete(id: number) {
        const hasProducts = await this.repo.hasProducts(id);
        if (hasProducts) {
            throw new ValidationError('Нельзя удалить единицу, которая используется в товарах');
        }
        return this.repo.delete(id);
    }
}

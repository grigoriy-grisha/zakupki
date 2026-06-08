import { CharacteristicRepository } from '../domain/characteristic.repository';

export class CharacteristicService {
    constructor(private repo: CharacteristicRepository) {}

    async list() {
        return this.repo.list();
    }

    async create(data: { name: string }) {
        return this.repo.create(data);
    }

    async update(id: number, data: { name?: string }) {
        return this.repo.update(id, data);
    }

    async delete(id: number) {
        return this.repo.delete(id);
    }
}

import { CharacteristicRepository } from '../domain/characteristic.repository';

export class CharacteristicService {
    constructor(private repo: CharacteristicRepository) {}

    list() {
        return this.repo.list();
    }

    create(data: { name: string }) {
        return this.repo.create(data);
    }

    update(id: number, data: { name?: string }) {
        return this.repo.update(id, data);
    }

    delete(id: number) {
        return this.repo.delete(id);
    }
}

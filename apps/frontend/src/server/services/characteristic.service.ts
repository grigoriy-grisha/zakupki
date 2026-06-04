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

    async move(id: number, direction: 'up' | 'down') {
        const all = await this.repo.list();
        const index = all.findIndex((c) => c.id === id);
        if (index < 0) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= all.length) return;
        await this.repo.swapPositions(id, all[targetIndex].id);
    }
}

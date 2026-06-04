import { AttributeTypeRepository, type AttributeTypeWriteData } from '../domain/attribute-type.repository';

export class AttributeTypeService {
    constructor(private repo: AttributeTypeRepository) {}

    list() {
        return this.repo.list();
    }

    create(data: { name: string; parentId?: number | null; showInTitle?: boolean }) {
        return this.repo.create(data);
    }

    update(id: number, data: AttributeTypeWriteData) {
        return this.repo.update(id, data);
    }

    delete(id: number) {
        return this.repo.delete(id);
    }

    async move(id: number, direction: 'up' | 'down') {
        const all = await this.repo.list();
        const current = all.find((t) => t.id === id);
        if (!current) return;
        // перемещаем только среди соседей (одинаковый parentId)
        const siblings = all.filter((t) => t.parentId === current.parentId);
        const index = siblings.findIndex((t) => t.id === id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;
        await this.repo.swapPositions(id, siblings[targetIndex].id);
    }
}

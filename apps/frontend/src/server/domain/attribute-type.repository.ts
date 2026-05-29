import type { PrismaClient } from '@zakupki/database';

export interface AttributeTypeWriteData {
    name?: string;
    showInTree?: boolean;
    showInTitle?: boolean;
}

export class AttributeTypeRepository {
    constructor(private db: PrismaClient) {}

    async list() {
        return this.db.attributeType.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: {
        name: string;
        parentId?: number | null;
        showInTree?: boolean;
        showInTitle?: boolean;
    }) {
        const last = await this.db.attributeType.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return this.db.attributeType.create({
            data: {
                name: data.name,
                parentId: data.parentId ?? null,
                position,
                showInTree: data.showInTree ?? true,
                showInTitle: data.showInTitle ?? true,
            },
        });
    }

    async update(id: number, data: AttributeTypeWriteData) {
        return this.db.attributeType.update({ where: { id }, data });
    }

    async delete(id: number) {
        return this.db.attributeType.delete({ where: { id } });
    }

    /** Меняет местами позицию двух типов (для кнопок вверх/вниз). */
    async swapPositions(id: number, otherId: number) {
        const [a, b] = await Promise.all([
            this.db.attributeType.findUnique({ where: { id } }),
            this.db.attributeType.findUnique({ where: { id: otherId } }),
        ]);
        if (!a || !b) return;
        await this.db.$transaction([
            this.db.attributeType.update({ where: { id: a.id }, data: { position: b.position } }),
            this.db.attributeType.update({ where: { id: b.id }, data: { position: a.position } }),
        ]);
    }
}

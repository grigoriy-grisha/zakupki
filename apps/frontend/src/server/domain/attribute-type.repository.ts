import { dbClient } from '@zakupki/database';

export interface AttributeTypeWriteData {
    name?: string;
    showInTitle?: boolean;
}

export class AttributeTypeRepository {
    async list() {
        return dbClient.attributeType.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { name: string; parentId?: number | null; showInTitle?: boolean }) {
        const last = await dbClient.attributeType.findFirst({ orderBy: { position: 'desc' } });
        const position = (last?.position ?? -1) + 1;
        return dbClient.attributeType.create({
            data: {
                name: data.name,
                parentId: data.parentId ?? null,
                position,
                showInTitle: data.showInTitle ?? true,
            },
        });
    }

    async update(id: number, data: AttributeTypeWriteData) {
        return dbClient.attributeType.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.attributeType.delete({ where: { id } });
    }

    /** Меняет местами позицию двух типов (для кнопок вверх/вниз). */
    async swapPositions(id: number, otherId: number) {
        const [a, b] = await Promise.all([
            dbClient.attributeType.findUnique({ where: { id } }),
            dbClient.attributeType.findUnique({ where: { id: otherId } }),
        ]);
        if (!a || !b) return;
        await dbClient.$transaction([
            dbClient.attributeType.update({ where: { id: a.id }, data: { position: b.position } }),
            dbClient.attributeType.update({ where: { id: b.id }, data: { position: a.position } }),
        ]);
    }
}

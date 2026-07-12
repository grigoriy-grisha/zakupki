import { dbClient } from '@zakupki/database';

import { getNextPosition } from '../lib/get-next-position';

export interface SupplierListRow {
    id: number;
    name: string;
    contact: string | null;
    notes: string | null;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { items: number };
}

export class SupplierRepository {
    async list(): Promise<SupplierListRow[]> {
        return dbClient.supplier.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            include: { _count: { select: { items: true } } },
        }) as Promise<SupplierListRow[]>;
    }

    async findById(id: number) {
        return dbClient.supplier.findUnique({ where: { id } });
    }

    async create(data: { name: string; contact?: string | null; notes?: string | null }) {
        const position = await getNextPosition((args) => dbClient.supplier.findFirst(args));
        return dbClient.supplier.create({
            data: {
                name: data.name,
                contact: data.contact ?? null,
                notes: data.notes ?? null,
                position,
            },
        });
    }

    async update(
        id: number,
        data: Partial<{ name: string; contact: string | null; notes: string | null; position: number }>,
    ) {
        return dbClient.supplier.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.supplier.delete({ where: { id } });
    }

    /** Считает, сколько PurchaseItem ссылается на этого поставщика. */
    async countItems(id: number): Promise<number> {
        return dbClient.purchaseItem.count({ where: { supplierId: id } });
    }
}

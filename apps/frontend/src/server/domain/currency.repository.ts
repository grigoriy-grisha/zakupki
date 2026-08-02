import { dbClient } from '@zakupki/database';

import { getNextPosition } from '../lib/get-next-position';

export interface CurrencyListRow {
    id: number;
    name: string;
    code: string | null;
    symbol: string | null;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { items: number; rates: number };
}

export class CurrencyRepository {
    async list(): Promise<CurrencyListRow[]> {
        return dbClient.currency.findMany({
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            include: { _count: { select: { items: true, rates: true } } },
        }) as Promise<CurrencyListRow[]>;
    }

    async findById(id: number) {
        return dbClient.currency.findUnique({ where: { id } });
    }

    async create(data: {
        name: string;
        code?: string | null;
        symbol?: string | null;
    }) {
        const position = await getNextPosition((args) => dbClient.currency.findFirst(args));
        return dbClient.currency.create({
            data: {
                name: data.name,
                code: data.code ?? null,
                symbol: data.symbol ?? null,
                position,
            },
        });
    }

    async update(
        id: number,
        data: Partial<{
            name: string;
            code: string | null;
            symbol: string | null;
            position: number;
        }>,
    ) {
        return dbClient.currency.update({ where: { id }, data });
    }

    async delete(id: number) {
        return dbClient.currency.delete({ where: { id } });
    }

    /**
     * Счётчики использования валюты: число товаров (PurchaseItem.currencyId,
     * onDelete: SetNull) и курсов закупок (PurchaseCurrencyRate.currencyId,
     * onDelete: Restrict — БД не даст удалить, пока есть ставка).
     */
    async countUsage(id: number): Promise<{ itemsCount: number; ratesCount: number }> {
        const [itemsCount, ratesCount] = await Promise.all([
            dbClient.purchaseItem.count({ where: { currencyId: id } }),
            dbClient.purchaseCurrencyRate.count({ where: { currencyId: id } }),
        ]);
        return { itemsCount, ratesCount };
    }
}

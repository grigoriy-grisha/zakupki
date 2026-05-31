import type { PrismaClient } from '@zakupki/database';
import { ValidationError } from '@zakupki/types';

const DEFAULT_UNITS = [
    { name: 'Граммы', shortName: 'г', multiplicity: 1 },
    { name: 'Штуки', shortName: 'шт', multiplicity: 1 },
    { name: 'Туба', shortName: 'туба', multiplicity: 1 },
] as const;

/** Возвращает id единицы учёта; создаёт стандартный набор, если таблица пуста. */
export async function ensureDefaultUnitId(db: PrismaClient): Promise<number> {
    const existing = await db.unit.findFirst({ orderBy: { id: 'asc' } });
    if (existing) return existing.id;

    await db.unit.createMany({ data: [...DEFAULT_UNITS] });
    const first = await db.unit.findFirst({ orderBy: { id: 'asc' } });
    if (!first) throw new ValidationError('Не удалось создать единицы учёта');
    return first.id;
}

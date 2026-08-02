/**
 * Единое место для всей математики qty / packages / limit.
 *
 * До этого рефактора "что считается qty" было размазано:
 *   - userCurrent в стратегиях
 *   - totalOrderedQuantity в aggregateForPool
 *   - currentQty в order-display
 * Все они считали по-разному, и пакеты (pkg * packSize) учитывались не везде —
 * отсюда баг: юзер с qty=70 + pkg=1 (30г) на supplierLimit=100 пускал сверх лимита.
 *
 * Правило одно: ЛЮБОЕ qty для целей лимита/пула = line.quantity + line.packageCount * packSize.
 * Никаких исключений, никаких "помним про пакеты отдельно".
 */
import type { OrderLine } from './order-line';
import type { OrderLineVO } from './types';

/** Эффективное qty строки: граммы + пакеты как граммы. Null → 0. */
export function effectiveQty(
    line: OrderLine | OrderLineVO | null,
    packSize: number | null,
): number {
    if (!line) return 0;
    const pack = packSize ?? 0;
    return Number(line.quantity) + Number(line.packageCount) * pack;
}

/** Сумма effective qty по списку строк. */
export function sumEffectiveQty(
    lines: readonly (OrderLine | OrderLineVO)[],
    packSize: number | null,
    filter?: (l: OrderLine | OrderLineVO) => boolean,
): number {
    let s = 0;
    for (const l of lines) {
        if (filter && !filter(l)) continue;
        s += effectiveQty(l, packSize);
    }
    return s;
}

/** Сумма effective qty одного юзера (все строки: base + supp). */
export function userEffectiveQty(
    lines: readonly OrderLine[],
    userId: number,
    packSize: number | null,
): number {
    return sumEffectiveQty(lines, packSize, (l) => l.userId === userId);
}

/** Сумма effective qty по всем активным строкам (для supplierLimit). */
export function totalOrderedQuantity(
    lines: readonly OrderLine[],
    packSize: number | null,
): number {
    return sumEffectiveQty(
        lines,
        packSize,
        (l) => 'isActive' in l && l.isActive,
    );
}

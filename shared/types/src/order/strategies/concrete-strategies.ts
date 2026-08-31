/**
 * Concrete strategies + factory.
 *
 * Этот файл — ПОСЛЕДНИЙ в цепочке импортов:
 *   concrete-strategies → stage-strategy (abstract) + atomic
 *   concrete strategies → stage-strategy (BaseMutableStrategy)
 *   factory (makeStrategy) → concrete strategies
 *
 * Разделение нужно, чтобы избежать циклической зависимости:
 * если импортировать concrete strategies из stage-strategy.ts, то при extend
 * `class X extends BaseMutableStrategy` BaseMutableStrategy ещё не определена
 * (т.к. concrete strategies → stage-strategy → ещё не загружен).
 */
import type { OrderLine } from '../order-line';
import type { PurchaseItem } from '../types';
import type { StageStrategy } from './stage-strategy';
import { CollectionStrategy } from './collection-strategy';
import { ReorderStrategy } from './reorder-strategy';
import { PaymentPlusStrategy } from './payment-plus-strategy';
import { OrderingClosedStrategy } from './ordering-closed-strategy';

// Re-export concrete classes для удобства (импорт из одного места)
export { CollectionStrategy } from './collection-strategy';
export { ReorderStrategy } from './reorder-strategy';
export { PaymentPlusStrategy } from './payment-plus-strategy';
export { OrderingClosedStrategy } from './ordering-closed-strategy';

// ── Factory ─────────────────────────────────────────────────────────

export function makeStrategy(item: PurchaseItem, lines: readonly OrderLine[]): StageStrategy {
    switch (item.fulfillmentStatus) {
        case 'COLLECTION':
            return new CollectionStrategy(item, lines);
        case 'REORDER':
            return new ReorderStrategy(item, lines);
        case 'PACKAGING':
        case 'READY_FOR_PICKUP':
            return new OrderingClosedStrategy(item, lines);
        default:
            return new PaymentPlusStrategy(item, lines);
    }
}

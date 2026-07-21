import type { OrderLineRef } from '../../lib/types';
import type { ProductLabelSource } from '../../../../products/lib';

/**
 * Форма позиции закупки из trpc.purchases.getById (для ручного редактирования).
 *
 * minPackageAmount/minPackageUnit живут на PurchaseItem (не Product — после
 * миграции 20260705154536 поля на Product удалены). multiplicity/unitCode
 * остаются на Product. Supplier берётся из инклуда позиции.
 */
export interface ParticipantOrderItem {
    minPackageAmount?: string | number | null;
    product?: ProductLabelSource & {
        unit?: { shortName: string } | null;
        unitCode?: string | null;
        multiplicity?: string | number | null;
    };
    supplier?: { id: number; name: string } | null;
}

/** OrderLine участника с вложенной позицией закупки (для отображения и шага ±). */
export type ParticipantOrder = OrderLineRef & { purchaseItem?: ParticipantOrderItem };

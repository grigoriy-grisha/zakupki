import { describe, expect, it } from 'vitest';

import { OrderBook, OrderLine } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem, makeLineProps } from '../__helpers__';

// ── REORDER: supplement line stage-scoped ──────────────────────────────
//
// Регрессия: reorder-strategy.ts использовал generic findSupplementLine,
// который находит supp-строку ЛЮБОГО этапа. Если бы существовала supp-строка
// с createdOnStage='PAYMENT' (утечка из будущего этапа или прямая вставка),
// REORDER модифицировал бы её вместо создания собственной REORDER-строки.
//
// После фикса используется findSupplementLineForStage, который ищет только
// supp-строку с createdOnStage === 'REORDER'.

describe('REORDER: supplement line stage-scoped (findSupplementLineForStage)', () => {
    it('adjust(+5) не трогает PAYMENT-созданную supp-строку → создаёт новую REORDER-строку', () => {
        // Сценарий: на этапе REORDER существует supp-строка с createdOnStage='PAYMENT'
        // (аномалия данных). REORDER adjust(+5) должен создать НОВУЮ REORDER-строку,
        // а не обновлять PAYMENT-строку.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 100 }), [
            makeFrozenCollectionLine({
                id: 1,
                userId: 1,
                quantity: 10,
                baseQuantity: 10,
                amountDue: 1000,
            }),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 20,
                    amountDue: 2000,
                    createdOnStage: 'PAYMENT',
                }),
            ),
        ]);

        const result = book1.adjust(1, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // PAYMENT-строка не тронута.
        const paymentLine = result.book.lines.find((l) => l.createdOnStage === 'PAYMENT');
        expect(paymentLine?.quantity).toBe(20);
        expect(paymentLine?.id).toBe(2);

        // Создалась новая REORDER-строка с qty=5.
        const reorderSupp = result.book.lines.find(
            (l) => l.createdOnStage === 'REORDER' && l.id !== 1,
        );
        expect(reorderSupp).toBeDefined();
        expect(reorderSupp?.quantity).toBe(5);
    });

    it('adjust(-N) с PAYMENT-строкой, но без REORDER-строки → убавляет base, не PAYMENT', () => {
        // base qty=10, PAYMENT-строка qty=20, REORDER-строки нет.
        // adjust(-5) должен убавить base (REORDER-supp отсутствует), а не PAYMENT-строку.
        const book1 = OrderBook.create(makeItem('REORDER', { targetRemainder: 100 }), [
            makeFrozenCollectionLine({
                id: 1,
                userId: 1,
                quantity: 10,
                baseQuantity: 10,
                amountDue: 1000,
            }),
            OrderLine.create(
                makeLineProps({
                    id: 2,
                    userId: 1,
                    quantity: 20,
                    amountDue: 2000,
                    createdOnStage: 'PAYMENT',
                }),
            ),
        ]);

        const result = book1.adjust(1, -5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // PAYMENT-строка не тронута (qty всё ещё 20).
        const paymentLine = result.book.lines.find((l) => l.createdOnStage === 'PAYMENT');
        expect(paymentLine?.quantity).toBe(20);

        // Base убавлен: 10 - 5 = 5.
        const base = result.book.lines.find((l) => l.id === 1);
        expect(base?.quantity).toBe(5);
    });
});

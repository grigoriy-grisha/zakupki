import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── PAYMENT+: supplierLimit должен учитывать пакеты (packSize) ──────────
//
// Регрессия: payment-plus-strategy.adjust вызывал aggregateForPool БЕЗ packSize,
// из-за чего totalOrderedWithPackages == totalOrderedQuantity (пакеты игнорировались)
// и validateSupplierLimit пропускал превышение лимита через упаковки.
//
// После фикса packSize передаётся, и лимит считается с учётом пакетов
// (так же, как в reorder-strategy.ts).
//
// ВАЖНО: targetRemainder задаём большим, чтобы pool НЕ ограничивал —
// изолированно проверяем только supplierLimit.

describe('PAYMENT+: adjust + supplierLimit учитывает пакеты', () => {
    it('+5 qty при effective=60, limit=100 → проходит (60+5=65 < 100)', () => {
        // effectiveUserQty = 30 (qty) + 1*30 (pkg) = 60. +5 → 65. < 100. Проходит.
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: 1000,
                packAmount: 30,
                packUnit: 'гр',
                supplierLimit: 100,
                supplierLimitUnit: 'гр',
            }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    userId: 1,
                    quantity: 30,
                    amountDue: 3000,
                    baseQuantity: 30,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
            ],
        );

        const result = book1.adjust(1, 5);

        // 60 (effective) + 5 = 65 < 100 → проходит.
        expect(result.ok).toBe(true);
    });

    it('+50 qty при effective=60, limit=100 → limit_exceeded (60+50=110 > 100)', () => {
        // До фикса: totalOrderedWithPackages не учитывал pkg → supplierPool считался
        // больше, чем есть → +50 могло пройти. После фикса — корректно падает.
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: 1000,
                packAmount: 30,
                packUnit: 'гр',
                supplierLimit: 100,
                supplierLimitUnit: 'гр',
            }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    userId: 1,
                    quantity: 30,
                    amountDue: 3000,
                    baseQuantity: 30,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
            ],
        );

        const result = book1.adjust(1, 50);

        // 60 + 50 = 110 > 100 → limit_exceeded.
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        // canAddMore = 100 - 60 = 40 (effective qty с пакетами).
        expect(result.error.canAddMore).toBe(40);
    });

    it('multi-user: user1 занял 60, user2 +50 → limit_exceeded (60+50=110 > 100)', () => {
        // Проверяем, что totalOrderedWithPackages учитывает пакеты ДРУГОГО юзера.
        // user1: qty=30, pkg=1 (pack=30) → effective=60.
        // user2: пытается +50. total=60+50=110 > 100 → должно упасть.
        const book1 = OrderBook.create(
            makeItem('PAYMENT', {
                targetRemainder: 1000,
                packAmount: 30,
                packUnit: 'гр',
                supplierLimit: 100,
                supplierLimitUnit: 'гр',
            }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    userId: 1,
                    quantity: 30,
                    amountDue: 3000,
                    baseQuantity: 30,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
            ],
        );

        const result = book1.adjust(2, 50);

        // user2 не имеет текущего заказа → currentQty=0. totalOrdered(effective)=60.
        // maxAllowed = supplierPool + currentQty = (100-60) + 0 = 40.
        // 50 > 40 → limit_exceeded.
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(40);
    });
});

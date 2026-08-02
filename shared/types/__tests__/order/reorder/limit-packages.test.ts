import { describe, expect, it } from 'vitest';

import { OrderBook } from '../../../src/order';
import { makeFrozenCollectionLine, makeItem } from '../__helpers__';

// ── REORDER: adjustPackages + supplierLimit ─────────────────────────
//
// Сценарий из бага: юзер на доборе имеет 70 гр + 1 пачка (30 гр) = 100 гр фактически.
// supplierLimit = 100 гр, packAmount = 30 гр. Берёт +1 пачку →
// userNew = 100 + 30 = 130. Лимит превышен, но это корректное поведение.
//
// Реальный баг — наоборот: сценарий, когда лимит НЕ должен срабатывать.
// Юзер имеет 30 гр + 1 пачка (30 гр) = 60 гр. Лимит = 100 гр. supplierPool
// считается от totalOrderedQuantity = 30 (НЕ включая пакет) → supplierPool = 70.
// Юзер берёт +1 пачку → userNew = 30 + 30 = 60. maxAllowed = 70 + 30 = 100.
// 60 < 100 → должно пройти. Но при delta=3 → userNew = 30 + 90 = 120 > 100 →
// ошибка с "Доступно: 70 гр" (canAddMore считается от totalOrdered без пакетов).

describe('Limit. REORDER: adjustPackages + supplierLimit', () => {
    it('+1 пачка при qty=30, pkg=1, limit=100, pack=30 → должно пройти (60+30=90 < 100)', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
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

        const result = book1.adjustPackages(1, 1);

        // Фактически: 30 гр + 1 пакет (=30) + 1 новый пакет (=30) = 90 гр. < 100. ОК.
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.book.supplementLineFor(1)?.packageCount).toBe(1);
    });

    it('+3 пачки при qty=30, pkg=1, limit=100, pack=30 → должно упасть (60+90=150 > 100)', () => {
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
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

        const result = book1.adjustPackages(1, 3);

        // Фактически: 30 + 1*30 (текущая пачка) + 3*30 (новые) = 150 > 100. Должна быть ошибка.
        // canAddMore считается от effective qty (с пакетами): 100 - 60 = 40 гр.
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(40);
    });

    it('+1 пачка при qty=70, pkg=1, limit=100, pack=30 → упасть (100+30=130 > 100)', () => {
        // Точно сценарий из бага: юзер уже набрал 100г (70+30), пытается ещё пачку.
        const book1 = OrderBook.create(
            makeItem('REORDER', {
                targetRemainder: null,
                packAmount: 30,
                packUnit: 'гр',
                supplierLimit: 100,
                supplierLimitUnit: 'гр',
            }),
            [
                makeFrozenCollectionLine({
                    id: 1,
                    userId: 1,
                    quantity: 70,
                    amountDue: 7000,
                    baseQuantity: 70,
                    packageCount: 1,
                    basePackageCount: 1,
                }),
            ],
        );

        const result = book1.adjustPackages(1, 1);

        // 70+30 (текущий pkg) + 30 (новый pkg) = 130 > 100. Должна быть ошибка.
        // canAddMore = 0 (некуда добавлять — лимит уже выбран).
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe('limit_exceeded');
        expect(result.error.canAddMore).toBe(0);
    });
});

import { describe, expect, it } from 'vitest';

import { computeRawSupplierLimit, validateSupplierLimit } from '../../../src/order';
import { makeItem } from '../__helpers__';

// ── Прямые unit-тесты валидатора supplierLimit ────────────────────

describe('Limit. Валидатор: validateSupplierLimit', () => {
    it('limit=null → возвращает null (без ограничений)', () => {
        const item = makeItem('COLLECTION', { supplierLimit: null });
        const err = validateSupplierLimit(item, 999_999, 0, {
            totalBaseQuantity: 0,
            supplementClaimed: 0,
            totalOrderedQuantity: 0,
            totalOrderedWithPackages: 0,
        });
        expect(err).toBeNull();
    });

    it('newQty <= limit → null', () => {
        const item = makeItem('COLLECTION', { supplierLimit: 150 });
        const err = validateSupplierLimit(item, 100, 0, {
            totalBaseQuantity: 0,
            supplementClaimed: 0,
            totalOrderedQuantity: 0,
            totalOrderedWithPackages: 0,
        });
        expect(err).toBeNull();
    });

    it('newQty > limit → limit_exceeded', () => {
        const item = makeItem('COLLECTION', { supplierLimit: 150, supplierLimitUnit: 'гр' });
        const err = validateSupplierLimit(item, 200, 0, {
            totalBaseQuantity: 0,
            supplementClaimed: 0,
            totalOrderedQuantity: 0,
            totalOrderedWithPackages: 0,
        });
        expect(err).not.toBeNull();
        expect(err!.code).toBe('limit_exceeded');
        expect(err!.canAddMore).toBe(150);
        expect(err!.message).toContain('Лимит поставщика');
        expect(err!.message).toContain('150');
        expect(err!.unitShort).toBe('гр');
    });

    it('currentQty > 0: maxAllowed учитывает текущее', () => {
        // currentQty=100, totalOrdered=200 (включая текущего), limit=300
        // pool = 300 - 200 = 100
        // maxAllowed = 100 + 100 = 200
        const item = makeItem('REORDER', { supplierLimit: 300 });
        const err = validateSupplierLimit(item, 201, 100, {
            totalBaseQuantity: 100,
            supplementClaimed: 0,
            totalOrderedQuantity: 200,
            totalOrderedWithPackages: 200,
        });
        expect(err).not.toBeNull();
        expect(err!.code).toBe('limit_exceeded');
        expect(err!.canAddMore).toBe(100); // maxAllowed - currentQty
    });

    it('computeRawSupplierLimit: limit=150, total=120 → 30', () => {
        const pool = computeRawSupplierLimit({
            supplierLimit: 150,
            aggregation: { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity: 120, totalOrderedWithPackages: 120 },
        });
        expect(pool).toBe(30);
    });

    it('computeRawSupplierLimit: limit=150, total=200 → 0 (не отрицательное)', () => {
        const pool = computeRawSupplierLimit({
            supplierLimit: 150,
            aggregation: { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity: 200, totalOrderedWithPackages: 200 },
        });
        expect(pool).toBe(0);
    });

    it('computeRawSupplierLimit: limit=null → null', () => {
        const pool = computeRawSupplierLimit({
            supplierLimit: null,
            aggregation: { totalBaseQuantity: 0, supplementClaimed: 0, totalOrderedQuantity: 50, totalOrderedWithPackages: 50 },
        });
        expect(pool).toBeNull();
    });

    it('computeRawSupplierLimit: учитывает пакеты в totalOrderedWithPackages', () => {
        // qty=100, pkg=2 (по 30) → effective=160. limit=150. pool = 150-160 = -10 → 0.
        const pool = computeRawSupplierLimit({
            supplierLimit: 150,
            aggregation: {
                totalBaseQuantity: 0,
                supplementClaimed: 0,
                totalOrderedQuantity: 100,
                totalOrderedWithPackages: 160,
            },
        });
        expect(pool).toBe(0);
    });
});

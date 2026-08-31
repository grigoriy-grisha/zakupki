import { describe, expect, it } from 'vitest';

import {
    computePackPriceRub,
    computePackPriceWithOrgFee,
    computeUnitPriceRub,
    solvePricePerPackFromPackOrgRub,
    solvePricePerPackFromPackRub,
    solvePricePerPackFromUnitRub,
} from '../../src/pricing';

const drift = (rate: number, orgFeePercent = 0, packAmount = 1) =>
    rate * 0.01 * (1 + orgFeePercent / 100) / packAmount + 0.01;

describe('solvePricePerPackFromPackRub (кол. 4 → валюта)', () => {
    it('делит на курс и округляет до 4 знаков', () => {
        expect(solvePricePerPackFromPackRub(100, 1.1)).toBe(90.9091);
        expect(solvePricePerPackFromPackRub(500, 90)).toBe(5.5556);
    });

    it('round-trip: прямая цепочка воспроизводит введённое ₽ в пределах дрейфа', () => {
        const solved = solvePricePerPackFromPackRub(1234.56, 1.1)!;
        const back = computePackPriceRub(solved, 1.1)!;
        expect(Math.abs(back - 1234.56)).toBeLessThanOrEqual(drift(1.1));
    });

    it('без курса или с нулевым курсом → null', () => {
        expect(solvePricePerPackFromPackRub(100, null)).toBeNull();
        expect(solvePricePerPackFromPackRub(100, 0)).toBeNull();
        expect(solvePricePerPackFromPackRub(null, 1.1)).toBeNull();
    });
});

describe('solvePricePerPackFromPackOrgRub (кол. 5 → валюта)', () => {
    it('делит на (1 + орг%) и курс', () => {
        expect(solvePricePerPackFromPackOrgRub(500, 1.1, 10)).toBe(413.2231);
    });

    it('орг% = 0 → эквивалентно кол. 4', () => {
        expect(solvePricePerPackFromPackOrgRub(500, 1.1, 0)).toBe(
            solvePricePerPackFromPackRub(500, 1.1),
        );
    });

    it('round-trip через кол. 5 в пределах дрейфа (курс 90)', () => {
        const solved = solvePricePerPackFromPackOrgRub(987.65, 90, 15)!;
        const packRub = computePackPriceRub(solved, 90)!;
        const back = computePackPriceWithOrgFee(packRub, 15)!;
        expect(Math.abs(back - 987.65)).toBeLessThanOrEqual(drift(90, 15));
    });

    it('отрицательный орг% ≤ −100% (делитель ≤ 0) → null', () => {
        expect(solvePricePerPackFromPackOrgRub(500, 1.1, -100)).toBeNull();
        expect(solvePricePerPackFromPackOrgRub(500, 1.1, -150)).toBeNull();
    });
});

describe('solvePricePerPackFromUnitRub (кол. 6 → валюта)', () => {
    it('умножает на вес упаковки и делит на (1 + орг%) и курс', () => {
        expect(solvePricePerPackFromUnitRub(5, 1.1, 10, 100)).toBe(413.2231);
    });

    it('введённая цена за 1ед восстанавливается точно (20₽/ед, курс 80, орг 10%, вес 50)', () => {
        const price = solvePricePerPackFromUnitRub(20, 80, 10, 50);
        expect(price).toBe(11.3636);
        const packRub = computePackPriceRub(price, 80);
        const packOrg = computePackPriceWithOrgFee(packRub, 10);
        expect(computeUnitPriceRub(packOrg, 50)).toBe(20);
    });

    it('round-trip через полную цепочку в пределах дрейфа', () => {
        const solved = solvePricePerPackFromUnitRub(2.5, 90, 10, 500)!;
        const packRub = computePackPriceRub(solved, 90)!;
        const packOrg = computePackPriceWithOrgFee(packRub, 10)!;
        const back = computeUnitPriceRub(packOrg, 500)!;
        expect(Math.abs(back - 2.5)).toBeLessThanOrEqual(drift(90, 10, 500));
    });

    it('штучный товар (упаковка 1) с орг% = 0', () => {
        expect(solvePricePerPackFromUnitRub(350, 1, 0, 1)).toBe(350);
    });

    it('без веса упаковки или вес ≤ 0 → null', () => {
        expect(solvePricePerPackFromUnitRub(5, 1.1, 10, null)).toBeNull();
        expect(solvePricePerPackFromUnitRub(5, 1.1, 10, 0)).toBeNull();
        expect(solvePricePerPackFromUnitRub(null, 1.1, 10, 100)).toBeNull();
    });
});

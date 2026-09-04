import { describe, expect, it } from 'vitest';

import { stepAlignedDelta } from '../order-collection.service';

describe('stepAlignedDelta', () => {
    it('never rounds up: 3 with step 2 gives +2, not +4', () => {
        expect(stepAlignedDelta(3, 2, 'add')).toBe(2);
    });

    it('keeps exact multiples intact', () => {
        expect(stepAlignedDelta(4, 2, 'add')).toBe(4);
        expect(stepAlignedDelta(10, 5, 'add')).toBe(10);
    });

    it('floors fractional amounts', () => {
        expect(stepAlignedDelta(7.5, 5, 'add')).toBe(5);
    });

    it('subtracts with the same floor semantics', () => {
        expect(stepAlignedDelta(3, 2, 'subtract')).toBe(-2);
        expect(stepAlignedDelta(6, 2, 'subtract')).toBe(-6);
    });

    it('piece step of 1 passes any integer amount through', () => {
        expect(stepAlignedDelta(7, 1, 'add')).toBe(7);
    });
});

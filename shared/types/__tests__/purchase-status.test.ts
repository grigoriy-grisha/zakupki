import { describe, expect, it } from 'vitest';

import { applyPieceUnitInvariants } from '../src/units/normalize';
import { canTransitionPurchaseStatus, PURCHASE_STATUS_TRANSITIONS } from '../src/purchase-status';

describe('PURCHASE_STATUS_TRANSITIONS', () => {
    it('allows DRAFT → ACTIVE', () => {
        expect(canTransitionPurchaseStatus('DRAFT', 'ACTIVE')).toBe(true);
    });

    it('allows ACTIVE → DONE', () => {
        expect(canTransitionPurchaseStatus('ACTIVE', 'DONE')).toBe(true);
    });

    it('allows DONE → ACTIVE as admin undo', () => {
        expect(canTransitionPurchaseStatus('DONE', 'ACTIVE')).toBe(true);
    });

    it('rejects DRAFT → DONE skipping activation', () => {
        expect(canTransitionPurchaseStatus('DRAFT', 'DONE')).toBe(false);
    });

    it('rejects DONE → DRAFT', () => {
        expect(canTransitionPurchaseStatus('DONE', 'DRAFT')).toBe(false);
    });

    it('rejects same-status transitions', () => {
        expect(canTransitionPurchaseStatus('ACTIVE', 'ACTIVE')).toBe(false);
        expect(canTransitionPurchaseStatus('DRAFT', 'DRAFT')).toBe(false);
    });

    it('vestigial CLOSED and ARRIVED are unreachable', () => {
        expect(canTransitionPurchaseStatus('ACTIVE', 'CLOSED')).toBe(false);
        expect(canTransitionPurchaseStatus('ACTIVE', 'ARRIVED')).toBe(false);
        expect(PURCHASE_STATUS_TRANSITIONS.CLOSED).toEqual([]);
        expect(PURCHASE_STATUS_TRANSITIONS.ARRIVED).toEqual([]);
    });
});

describe('applyPieceUnitInvariants', () => {
    it('forces packAmount=1 and drops pack fields for piece requests', () => {
        const fields = { packAmount: 50, minPackageAmount: 5, supplementStep: 10 };
        applyPieceUnitInvariants('piece', fields);
        expect(fields).toEqual({ packAmount: 1, minPackageAmount: null, supplementStep: null });
    });

    it('applies to tube as well', () => {
        const fields = { packAmount: 12, minPackageAmount: 6, supplementStep: 3 };
        applyPieceUnitInvariants('tube', fields);
        expect(fields).toEqual({ packAmount: 1, minPackageAmount: null, supplementStep: null });
    });

    it('does not touch fields absent from the request', () => {
        const fields = { description: 'x' };
        applyPieceUnitInvariants('piece', fields);
        expect(fields).toEqual({ description: 'x' });
    });

    it('keeps gram requests untouched', () => {
        const fields = { packAmount: 50, minPackageAmount: 5, supplementStep: 10 };
        applyPieceUnitInvariants('gram', fields);
        expect(fields).toEqual({ packAmount: 50, minPackageAmount: 5, supplementStep: 10 });
    });

    it('no-op for unknown units', () => {
        const fields = { packAmount: 50 };
        applyPieceUnitInvariants('pcs', fields);
        expect(fields).toEqual({ packAmount: 50 });
    });
});

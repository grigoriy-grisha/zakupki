import { formatQtyLabel } from '../utils';
import { isPieceUnit } from './normalize';
import { getUnitByCode, unitPluralForm } from './registry';

export function formatUnitQty(quantity: number, unitCode: string | null | undefined): string {
    return `${formatQtyLabel(quantity)} ${getUnitWord(quantity, unitCode)}`;
}

export function getUnitWord(quantity: number, unitCode: string | null | undefined): string {
    const def = getUnitByCode(unitCode ?? '');
    return def ? unitPluralForm(quantity, def) : 'ед.';
}

export function getUnitPrepositional(unitCode: string | null | undefined): string | null {
    return getUnitByCode(unitCode ?? '')?.prepositional ?? null;
}

export interface QuantityDisplayInput {
    quantity: number;
    packageCount: number;
    packSize: number | null;
    unitCode: string | null | undefined;
}

export interface QuantityDisplay {
    main: string;
    total: string | null;
}

export function buildQuantityDisplay(input: QuantityDisplayInput): QuantityDisplay {
    const qty = Number.isFinite(input.quantity) ? input.quantity : 0;
    const packs = Number.isFinite(input.packageCount) ? Math.max(0, Math.round(input.packageCount)) : 0;
    const packSize = input.packSize != null && Number.isFinite(input.packSize) ? input.packSize : null;

    if (isPieceUnit(input.unitCode)) {
        const effective = qty + packs * (packSize ?? 1);
        return { main: formatUnitQty(effective, input.unitCode), total: null };
    }

    const parts: string[] = [];
    if (qty > 0) parts.push(formatUnitQty(qty, input.unitCode));
    if (packs > 0) parts.push(`${packs} уп`);
    if (parts.length === 0) parts.push(formatUnitQty(0, input.unitCode));

    const total = qty > 0 && packs > 0 && packSize != null
        ? `всего ${formatUnitQty(qty + packs * packSize, input.unitCode)}`
        : null;

    return { main: parts.join(' + '), total };
}

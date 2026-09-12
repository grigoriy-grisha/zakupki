import {
    formatUnitQty,
    getUnitByCode,
    getUnitPrepositional,
    isSupplementPhase,
    isWeightUnit,
    PURCHASE_FULFILLMENT_STATUSES,
} from '@zakupki/types';

const GENERAL_QUANTITY_HINT =
    'Напишите количество числом. Например:\n• 10 — добавить 10\n• +10 — добавить 10\n• +2п — добавить 2 пачки\n• -5 — убрать 5\n• -1п — убрать пачку';

const GENERAL_QUANTITY_HINT_PIECE =
    'Напишите количество числом. Например:\n• 2 — добавить 2\n• +2 — добавить 2\n• -1 — убрать 1';

function weightPrepositional(unitCode: string | null | undefined): string {
    return getUnitPrepositional(unitCode) ?? 'граммах';
}

function weightShort(unitCode: string | null | undefined): string {
    return getUnitByCode(unitCode ?? '')?.shortName ?? 'гр';
}

function doborWeightHint(unitCode: string | null | undefined): string {
    const prep = weightPrepositional(unitCode);
    const short = weightShort(unitCode);
    return [
        'На этапе «Добор» можно добавить только:',
        `• остаток до полной пачки поставщика — указывайте нужное количество в ${prep}, кратное минимальной фасовке;`,
        '• целую пачку поставщика — указывайте количество с буквой «п».',
        'Например: 1п — 1 упаковка (пакет), 2п — 2 упаковки, 3п — 3 упаковки.',
        `❗️ Просто цифра без буквы «п» считается количеством в ${prep}.`,
        'То есть:',
        `10 = 10 ${short}`,
        '1п = 1 целая пачка поставщика',
    ].join('\n');
}

function paymentWeightHint(unitCode: string | null | undefined): string {
    const short = weightShort(unitCode);
    return [
        '‼️ Пора оплачивать заказ ‼️',
        '',
        'На этом этапе можно добавить только остатки до полной пачки поставщика.',
        `Указывайте нужное количество в ${weightPrepositional(unitCode)} (кратно минимальной фасовке)`,
        `Например: 5 = 5 ${short}, 10 = 10 ${short}, 20 = 20 ${short}.`,
    ].join('\n');
}

function doborPieceHint(unitCode: string | null | undefined): string {
    return [
        'На этапе «Добор» можно добавить только оставшееся количество товара.',
        `Указывайте количество в ${getUnitPrepositional(unitCode) ?? 'штуках'}.`,
        `Например: 2 = ${formatUnitQty(2, unitCode ?? 'piece')}.`,
    ].join('\n');
}

function paymentPieceHint(unitCode: string | null | undefined): string {
    return [
        '‼️ Пора оплачивать заказ ‼️',
        '',
        'На этом этапе можно добавить только остатки товара.',
        `Указывайте количество в ${getUnitPrepositional(unitCode) ?? 'штуках'} (например: 2 = ${formatUnitQty(2, unitCode ?? 'piece')}).`,
    ].join('\n');
}

function isPaymentPhase(fulfillmentStatus: string): boolean {
    const order = PURCHASE_FULFILLMENT_STATUSES as readonly string[];
    const idx = order.indexOf(fulfillmentStatus);
    const paymentIdx = order.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

export function getOrderQuantityHint(fulfillmentStatus: string | null | undefined, unitCode?: string | null): string {
    const status = fulfillmentStatus ?? '';
    const weight = unitCode == null ? true : isWeightUnit(unitCode);
    if (isPaymentPhase(status)) {
        return weight ? paymentWeightHint(unitCode) : paymentPieceHint(unitCode);
    }
    if (isSupplementPhase(status)) {
        return weight ? doborWeightHint(unitCode) : doborPieceHint(unitCode);
    }
    return weight ? GENERAL_QUANTITY_HINT : GENERAL_QUANTITY_HINT_PIECE;
}

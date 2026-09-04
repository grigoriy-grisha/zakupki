import { isSupplementPhase, PURCHASE_FULFILLMENT_STATUSES } from '@zakupki/types';

const GENERAL_QUANTITY_HINT =
    'Напишите количество числом. Например:\n• 10 — добавить 10\n• +10 — добавить 10\n• +2п — добавить 2 пачки\n• -5 — убрать 5\n• -1п — убрать пачку';

const GENERAL_QUANTITY_HINT_PIECE =
    'Напишите количество числом. Например:\n• 2 — добавить 2\n• +2 — добавить 2\n• -1 — убрать 1';

const DOBOR_QUANTITY_HINT = [
    'На этапе «Добор» можно добавить только:',
    '• остаток бисера до полной пачки поставщика — указывайте нужное количество в граммах, кратное минимальной фасовке;',
    '• целую пачку поставщика — указывайте количество с буквой «п».',
    'Например: 1п — 1 упаковка (пакет), 2п — 2 упаковки, 3п — 3 упаковки.',
    '❗️ Просто цифра без буквы «п» считается количеством в граммах.',
    'То есть:',
    '10 = 10 гр',
    '1п = 1 целая пачка поставщика',
].join('\n');

const DOBOR_QUANTITY_HINT_PIECE = [
    'На этапе «Добор» можно добавить только оставшееся количество товара.',
    'Указывайте количество в штуках.',
    'Например: 2 = 2 шт.',
].join('\n');

const PAYMENT_QUANTITY_HINT = [
    '‼️ Пора оплачивать заказ ‼️',
    '',
    'На этом этапе можно добавить только остатки бисера до полной пачки поставщика.',
    'Указывайте нужное количество в граммах (кратно минимальной фасовке)',
    'Например: 5 = 5 гр, 10 = 10 гр, 20 = 20 гр.',
].join('\n');

const PAYMENT_QUANTITY_HINT_PIECE = [
    '‼️ Пора оплачивать заказ ‼️',
    '',
    'На этом этапе можно добавить только остатки товара.',
    'Указывайте количество в штуках (например: 2 = 2 шт).',
].join('\n');

function isPaymentPhase(fulfillmentStatus: string): boolean {
    const order = PURCHASE_FULFILLMENT_STATUSES as readonly string[];
    const idx = order.indexOf(fulfillmentStatus);
    const paymentIdx = order.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

export function getOrderQuantityHint(fulfillmentStatus: string | null | undefined, isWeightUnit = true): string {
    const status = fulfillmentStatus ?? '';
    if (isPaymentPhase(status)) {
        return isWeightUnit ? PAYMENT_QUANTITY_HINT : PAYMENT_QUANTITY_HINT_PIECE;
    }
    if (isSupplementPhase(status)) {
        return isWeightUnit ? DOBOR_QUANTITY_HINT : DOBOR_QUANTITY_HINT_PIECE;
    }
    return isWeightUnit ? GENERAL_QUANTITY_HINT : GENERAL_QUANTITY_HINT_PIECE;
}

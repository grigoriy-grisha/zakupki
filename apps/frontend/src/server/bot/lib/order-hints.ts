import { isSupplementPhase, PURCHASE_FULFILLMENT_STATUSES } from '@zakupki/types';

const GENERAL_QUANTITY_HINT =
    'Напишите количество числом. Например:\n• 10 — добавить 10\n• +10 — добавить 10\n• +2п — добавить 2 пачки\n• -5 — убрать 5\n• -1п — убрать пачку';

const DOBOR_QUANTITY_HINT = [
    'На этапе «Добор» можно добавить только:',
    '• остаток бисера до полной пачки поставщика — указывайте нужное количество в граммах, кратное минимальной фасовке;',
    '• целую пачку поставщика — указывайте количество с буквой «п».',
    'Например: 1п — 1 упаковка (пакет), 2п — 2 упаковки, 3п — 3 упаковки.',
    '🧵 Просто цифра без буквы «п» считается количеством в граммах.',
    'То есть:',
    '10 = 10 гр',
    '1п = 1 целая пачка поставщика',
].join('\n');

const PAYMENT_QUANTITY_HINT = [
    '🧵Пора оплачивать заказ🧵',
    '',
    'На этом этапе можно добавить только остатки бисера до полной пачки поставщика.',
    'Указывайте нужное количество в граммах (кратно минимальной фасовке)',
    'Например: 5 = 5 гр, 10 = 10 гр, 20 = 20 гр.',
].join('\n');

function isPaymentPhase(fulfillmentStatus: string): boolean {
    const order = PURCHASE_FULFILLMENT_STATUSES as readonly string[];
    const idx = order.indexOf(fulfillmentStatus);
    const paymentIdx = order.indexOf('PAYMENT');
    return idx >= 0 && paymentIdx >= 0 && idx >= paymentIdx;
}

export function getOrderQuantityHint(fulfillmentStatus: string | null | undefined): string {
    const status = fulfillmentStatus ?? '';
    if (isPaymentPhase(status)) return PAYMENT_QUANTITY_HINT;
    if (isSupplementPhase(status)) return DOBOR_QUANTITY_HINT;
    return GENERAL_QUANTITY_HINT;
}

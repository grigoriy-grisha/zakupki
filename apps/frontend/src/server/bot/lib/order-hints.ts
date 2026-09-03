import { isSupplementPhase } from '@zakupki/types';

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

export function getOrderQuantityHint(fulfillmentStatus: string | null | undefined): string {
    return isSupplementPhase(fulfillmentStatus ?? '') ? DOBOR_QUANTITY_HINT : GENERAL_QUANTITY_HINT;
}

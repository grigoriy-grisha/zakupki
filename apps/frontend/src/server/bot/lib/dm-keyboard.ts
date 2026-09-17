import type { InlineKeyboardMarkup } from 'grammy/types';

import type { BotConfig } from '../config/bot-config';
import { CallbackParser } from '../domain/callback-data';
import { shopTargetDeepLink } from './webapp-url';

export function buildHandoffChoiceKeyboard(purchaseOrderId: number): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                {
                    text: 'Оставить на хранение',
                    callback_data: CallbackParser.build({ kind: 'handoff:store', purchaseOrderId }),
                },
            ],
            [
                {
                    text: 'Отправить заказ',
                    callback_data: CallbackParser.build({ kind: 'handoff:ship', purchaseOrderId }),
                },
            ],
        ],
    };
}

export function buildOpenPurchaseKeyboard(payload: unknown, cfg: BotConfig): InlineKeyboardMarkup | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const data = payload as { purchaseId?: unknown; purchaseItemId?: unknown };
    const purchaseId = data.purchaseId;
    if (typeof purchaseId !== 'number' || !Number.isFinite(purchaseId)) return null;
    const itemId =
        typeof data.purchaseItemId === 'number' && Number.isFinite(data.purchaseItemId) ? data.purchaseItemId : undefined;

    const link = shopTargetDeepLink(cfg, purchaseId, itemId);
    if (!link) return null;

    const button = link.telegram
        ? { text: 'Открыть закупку', url: link.url }
        : { text: 'Открыть закупку', web_app: { url: link.url } };
    return { inline_keyboard: [[button]] };
}

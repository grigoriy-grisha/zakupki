export type TelegramStartTarget = { purchaseId: number; itemId?: number };

/** GET-параметр, в котором Telegram дублирует startapp при открытии мини-аппа. */
export const TELEGRAM_START_PARAM_QUERY_KEY = 'tgWebAppStartParam';

export function parseTelegramStartParam(startParam: string | null | undefined): TelegramStartTarget | null {
    const match = /^p(\d+)(?:i(\d+))?$/.exec(startParam?.trim() ?? '');
    if (!match) return null;

    const purchaseId = Number(match[1]);
    if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0) return null;

    if (match[2] == null) return { purchaseId };
    const itemId = Number(match[2]);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) return null;
    return { purchaseId, itemId };
}

/** Цель из query-строки текущего URL (tgWebAppStartParam). */
export function parseTelegramStartParamFromQuery(search: string): TelegramStartTarget | null {
    return parseTelegramStartParam(new URLSearchParams(search).get(TELEGRAM_START_PARAM_QUERY_KEY));
}

export function shopPathForStartTarget(target: TelegramStartTarget): string {
    return target.itemId != null
        ? `/shop/purchase/${target.purchaseId}/item/${target.itemId}`
        : `/shop/purchase/${target.purchaseId}`;
}

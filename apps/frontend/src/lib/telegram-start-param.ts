export type TelegramStartTarget = { purchaseId: number; itemId?: number };

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

export function shopPathForStartTarget(target: TelegramStartTarget): string {
    return target.itemId != null
        ? `/shop/purchase/${target.purchaseId}/item/${target.itemId}`
        : `/shop/purchase/${target.purchaseId}`;
}

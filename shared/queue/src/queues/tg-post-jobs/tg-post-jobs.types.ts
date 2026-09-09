export type TgPostJob =
    | { type: 'POST_CREATE'; itemId: number }
    | { type: 'POST_DELETE'; itemId: number; messageId?: string; channelId?: string }
    | { type: 'USER_ORDERS_REJECT'; messageIds: string[] }
    | { type: 'ITEM_CHANGED'; itemId: number }
    | { type: 'SHOP_COMMENT_ATTACH'; itemId: number; attempt: number }
    | { type: 'PURCHASE_ITEM_SYNC'; purchaseId: number; itemId: number; kind: 'fulfillment' | 'status'; next: string }
    | { type: 'PURCHASE_FULFILLMENT_CHANGED'; purchaseId: number; prev: string; next: string }
    | { type: 'PURCHASE_STATUS_CHANGED'; purchaseId: number; prev: string; next: string };

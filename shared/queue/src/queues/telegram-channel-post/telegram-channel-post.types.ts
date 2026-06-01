export type TelegramChannelPostJob =
    | {
          type: 'PURCHASE_ITEM_CHANNEL_POST' | 'PURCHASE_ITEM_CHANNEL_POST_EDIT';
          purchaseItemId: number;
      }
    | {
          type: 'PURCHASE_ITEM_CHANNEL_POST_DELETE';
          tgChannelId: string;
          tgMessageId: string;
      };

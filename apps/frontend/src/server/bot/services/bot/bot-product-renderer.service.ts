import { renderById, SHOP_COMMENT_TEXT, type ProductHeaderData, type StatusLineData } from '../../renderers';

/**
 * Bot-специфичный product renderer. Оборачивает renderById с типизированным API
 * для основных случаев использования в TgPostWorker.
 *
 * Phase F: тонкая обёртка над renderById из bot/renderers (который сейчас
 * переэкспортирует из lib/section-renderers). В будущем — копия логики
 * прямо в bot/.
 */
export class BotProductRenderer {
    buildPostHeader(data: ProductHeaderData): string {
        return renderById('PRODUCT_HEADER', data) ?? '';
    }

    buildStatusLine(data: StatusLineData): string {
        return renderById('STATUS_LINE', data) ?? '';
    }

    buildFulfillmentComment(data: { status: string; channelPostMessageId: number }): string {
        return renderById('FULFILLMENT_COMMENT', data) ?? '';
    }

    buildPurchaseStatusComment(data: { status: string; channelPostMessageId: number }): string {
        return renderById('PURCHASE_STATUS_COMMENT', data) ?? '';
    }

    get shopCommentText(): string {
        return SHOP_COMMENT_TEXT;
    }
}

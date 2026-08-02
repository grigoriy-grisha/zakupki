/**
 * Bot-internal re-export layer для section-renderers.
 *
 * Source of truth остаётся в `apps/frontend/src/server/lib/section-renderers/`.
 * Здесь мы переэкспортируем под bot-локальным путём, чтобы TgPostWorker и любой
 * другой bot-код не импортировал напрямую из `../../lib/section-renderers`.
 *
 * В будущем (Phase F+): полная копия renderer'ов в `bot/renderers/*.renderer.ts`
 * с bot-локальным RendererRegistry. Сейчас — single source of truth.
 */

export {
    renderById,
    type FulfillmentCommentData,
    type ProductHeaderData,
    type PurchaseStatusCommentData,
    type StatusLineData,
} from '@/server/lib/section-renderers';
export { SHOP_COMMENT_TEXT } from '@/server/lib/section-renderers/shop-comment.renderer';

import { BaseSectionRenderer, type SectionProps } from './base-section-renderer';

export const SHOP_COMMENT_TEXT = '👇 Оформить заказ в приложении:';

export interface ShopCommentData {
    /** Опциональный subtext — например, "Только для авторизованных" (сейчас не используется). */
    subtext?: string;
}

/**
 * Текст shop-комментария под постом в канале.
 * Клавиатура (URL-кнопка на webapp) формируется отдельно в `webapp-url.ts`,
 * этот рендерер отвечает только за текст.
 */
export class ShopCommentRenderer extends BaseSectionRenderer<ShopCommentData> {
    readonly id = 'SHOP_COMMENT' as const;

    render({ data: _data }: SectionProps<ShopCommentData>): string | null {
        return SHOP_COMMENT_TEXT;
    }
}

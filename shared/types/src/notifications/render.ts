import {
    HANDOFF_DEFAULT_LABEL,
    HANDOFF_STATUS_LABELS,
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_STATUS_LABELS,
} from '../index';
import type { HandoffStatus, PurchaseFulfillmentStatus, PurchaseStatus } from '../index';
import { formatQtyLabel } from '../utils';
import type { NotificationPayload, NotificationType } from './types';

/**
 * Pure renderers that turn a (type, payload) pair into Russian-facing strings.
 * Called once at notification row creation to denormalize into `title`/`body`,
 * so list queries never need to re-render. Do NOT call from the client or the
 * bot worker — they read the stored `title`/`body`/`url` columns directly.
 */

/** Short human title, used as the notification headline in the bell & list. */
export function renderNotificationTitle(type: NotificationType): string {
    switch (type) {
        case 'PAYMENT_CONFIRMED':
            return 'Оплата подтверждена';
        case 'PAYMENT_REJECTED':
            return 'Оплата отклонена';
        case 'ORDER_QTY_CHANGED':
            return 'Заказ изменён';
        case 'ORDER_LINE_DELETED':
            return 'Позиция удалена';
        case 'ORDER_CLEARED':
            return 'Заказ очищен';
        case 'ORDER_HANDOFF_STATUS':
            return 'Статус заказа обновлён';
        case 'PURCHASE_FULFILLMENT_STAGE':
            return 'Этап закупки обновлён';
        case 'PURCHASE_STATUS_CHANGED':
            return 'Статус закупки обновлён';
    }
}

/** Full body text. Telegram HTML-unfriendly characters are NOT escaped here —
 * the bot wraps with HTML mode, callers must pre-escape if needed. */
export function renderNotificationBody<T extends NotificationType>(
    type: T,
    payload: NotificationPayload<T>,
): string {
    switch (type) {
        case 'PAYMENT_CONFIRMED': {
            const p = payload as NotificationPayload<'PAYMENT_CONFIRMED'>;
            const base = `Закупка ${formatTag(p.purchaseTag)}: подтверждена оплата ${formatAmount(p.amount)}.`;
            return p.adminNote ? `${base}\nКомментарий: ${p.adminNote}` : base;
        }
        case 'PAYMENT_REJECTED': {
            const p = payload as NotificationPayload<'PAYMENT_REJECTED'>;
            const base = `Закупка ${formatTag(p.purchaseTag)}: отклонена оплата ${formatAmount(p.amount)}.`;
            return p.adminNote ? `${base}\nПричина: ${p.adminNote}` : base;
        }
        case 'ORDER_QTY_CHANGED': {
            const p = payload as NotificationPayload<'ORDER_QTY_CHANGED'>;
            // `prevQty` was added to the payload after launch; legacy rows don't
            // have it. Treat absent/invalid as "unknown" and skip the "было" part
            // rather than crashing on Number(undefined).toFixed().
            const hasPrev = Number.isFinite(p.prevQty as number | undefined);
            const prevPart = hasPrev ? `было ${formatQtyLabel(p.prevQty)} ${p.unitShort}, ` : '';
            return (
                `Закупка ${formatTag(p.purchaseTag)}: администратор изменил количество ` +
                `«${p.productLabel}»: ${prevPart}стало ${formatQtyLabel(p.newQty)} ${p.unitShort}.`
            );
        }
        case 'ORDER_LINE_DELETED': {
            const p = payload as NotificationPayload<'ORDER_LINE_DELETED'>;
            return `Закупка ${formatTag(p.purchaseTag)}: администратор удалил позицию «${p.productLabel}» из вашего заказа.`;
        }
        case 'ORDER_CLEARED': {
            const p = payload as NotificationPayload<'ORDER_CLEARED'>;
            return `Закупка ${formatTag(p.purchaseTag)}: администратор очистил ваш заказ.`;
        }
        case 'ORDER_HANDOFF_STATUS': {
            const p = payload as NotificationPayload<'ORDER_HANDOFF_STATUS'>;
            if (p.status == null) {
                return `Закупка ${formatTag(p.purchaseTag)}: статус вашего заказа сброшен.`;
            }
            const label = HANDOFF_STATUS_LABELS[p.status as HandoffStatus];
            return `Закупка ${formatTag(p.purchaseTag)}: статус вашего заказа — «${label}».`;
        }
        case 'PURCHASE_FULFILLMENT_STAGE': {
            const p = payload as NotificationPayload<'PURCHASE_FULFILLMENT_STAGE'>;
            const label = PURCHASE_FULFILLMENT_LABELS[p.stage as PurchaseFulfillmentStatus];
            return `Закупка ${formatTag(p.purchaseTag)} перешла на этап «${label}».`;
        }
        case 'PURCHASE_STATUS_CHANGED': {
            const p = payload as NotificationPayload<'PURCHASE_STATUS_CHANGED'>;
            const label = PURCHASE_STATUS_LABELS[p.status as PurchaseStatus];
            return `Закупка ${formatTag(p.purchaseTag)}: статус «${label}».`;
        }
    }
}

/**
 * Telegram-HTML body. Unlike `renderNotificationBody` (plain text for the web
 * bell), this variant adds:
 *   - a <b>bold</b> headline (the same headline the web card uses as title),
 *   - structured multi-line layout with <b>labels</b> for key fields.
 *
 * The user-supplied bits (tag, product label, admin note) are HTML-escaped —
 * Telegram rejects unescaped <, >, & as malformed HTML and the worker would
 * swallow the notification on a permanent "bad request". Numeric / enum-derived
 * fragments (amounts, stage labels) are safe by construction.
 *
 * The web bell does NOT use this — it reads the structured fields via
 * `getNotificationFields` and renders them as DOM. This function is the only
 * consumer of the `body` column when delivery goes to Telegram.
 */
export function renderNotificationTelegramBody<T extends NotificationType>(
    type: T,
    payload: NotificationPayload<T>,
): string {
    const p = payload as NotificationPayload<typeof type>;
    const title = renderNotificationTitle(type);
    const lines: string[] = [`<b>${title}</b>`, `Закупка ${escapeHtml(formatTag(p.purchaseTag))}`];

    switch (type) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_REJECTED': {
            const pp = p as NotificationPayload<'PAYMENT_CONFIRMED'>;
            lines.push(`<b>Сумма:</b> ${escapeHtml(formatAmount(pp.amount))}`);
            if (pp.adminNote) {
                const label = type === 'PAYMENT_CONFIRMED' ? 'Комментарий' : 'Причина';
                lines.push(`<b>${label}:</b> ${escapeHtml(pp.adminNote)}`);
            }
            break;
        }
        case 'ORDER_QTY_CHANGED': {
            const pp = p as NotificationPayload<'ORDER_QTY_CHANGED'>;
            lines.push(`<b>Товар:</b> ${escapeHtml(pp.productLabel)}`);
            if (Number.isFinite(pp.prevQty as number | undefined)) {
                lines.push(`<b>Было:</b> ${escapeHtml(formatQtyLabel(pp.prevQty))} ${escapeHtml(pp.unitShort)}`);
            }
            lines.push(`<b>Стало:</b> ${escapeHtml(formatQtyLabel(pp.newQty))} ${escapeHtml(pp.unitShort)}`);
            break;
        }
        case 'ORDER_LINE_DELETED': {
            const pp = p as NotificationPayload<'ORDER_LINE_DELETED'>;
            lines.push(`<b>Товар:</b> ${escapeHtml(pp.productLabel)}`);
            break;
        }
        case 'ORDER_CLEARED':
            // No extra fields — the title + tag already tell the whole story.
            break;
        case 'ORDER_HANDOFF_STATUS': {
            const pp = p as NotificationPayload<'ORDER_HANDOFF_STATUS'>;
            const label = pp.status == null ? HANDOFF_DEFAULT_LABEL : HANDOFF_STATUS_LABELS[pp.status as HandoffStatus];
            lines.push(`<b>Статус:</b> ${escapeHtml(label)}`);
            break;
        }
        case 'PURCHASE_FULFILLMENT_STAGE': {
            const pp = p as NotificationPayload<'PURCHASE_FULFILLMENT_STAGE'>;
            const label = PURCHASE_FULFILLMENT_LABELS[pp.stage as PurchaseFulfillmentStatus];
            lines.push(`<b>Новый этап:</b> ${escapeHtml(label)}`);
            break;
        }
        case 'PURCHASE_STATUS_CHANGED': {
            const pp = p as NotificationPayload<'PURCHASE_STATUS_CHANGED'>;
            const label = PURCHASE_STATUS_LABELS[pp.status as PurchaseStatus];
            lines.push(`<b>Новый статус:</b> ${escapeHtml(label)}`);
            break;
        }
    }

    return lines.join('\n');
}

/**
 * Deep link into the shop, or null if no sensible target. `purchaseId` is the
 * numeric route key; `tag` is display-only and not URL-safe.
 */
export function renderNotificationUrl<T extends NotificationType>(
    type: T,
    payload: NotificationPayload<T>,
): string | null {
    switch (type) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_REJECTED':
        case 'ORDER_HANDOFF_STATUS':
            return '/shop/orders';
        case 'ORDER_QTY_CHANGED':
        case 'ORDER_LINE_DELETED':
        case 'ORDER_CLEARED':
        case 'PURCHASE_FULFILLMENT_STAGE':
        case 'PURCHASE_STATUS_CHANGED': {
            const p = payload as NotificationPayload<typeof type>;
            return p.purchaseId != null ? `/shop/purchase/${p.purchaseId}` : '/shop';
        }
    }
}

function formatAmount(amount: number): string {
    // Money: integer rubles render without decimals, fractional with 2 places.
    return amount % 1 === 0 ? `${amount} ₽` : `${amount.toFixed(2)} ₽`;
}

/**
 * Render a purchase tag for display. The tag is stored in the DB already
 * including the leading `#` (see `formatPurchaseTag`), so we return it as-is.
 * If a future row somehow lacks the prefix, add it — callers expect exactly
 * one `#` in front (a stray double `##` looks like a bug to users).
 */
function formatTag(tag: string): string {
    return tag.startsWith('#') ? tag : `#${tag}`;
}

/**
 * Minimal HTML escape for Telegram parse_mode=HTML. Covers the three
 * characters Telegram treats as markup (<, >, &). Anything user-supplied
 * (product names, admin notes, purchase tags) must go through this before
 * being interpolated into the HTML body, or Telegram rejects the message
 * as malformed and the worker swallows the notification.
 */
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Visual + structured-field helpers (for the UI) ─────────────────────────
//
// The string `title`/`body` above is denormalized into the DB row and read by
// both the Telegram worker and the web bell. These helpers are pure UI hints
// computed client-side from `(type, payload)` — they don't go through the DB,
// so they can evolve freely without a migration.

/** Iconographic kind for a notification type — UI maps it to a lucide icon. */
export type NotificationIconKind =
    | 'payment-success'
    | 'payment-fail'
    | 'order-edit'
    | 'order-remove'
    | 'handoff'
    | 'stage'
    | 'status';

/** Color accent / tone — UI maps it to Tailwind color tokens. */
export type NotificationTone = 'success' | 'critical' | 'warning' | 'accent' | 'neutral';

export interface NotificationVisual {
    icon: NotificationIconKind;
    tone: NotificationTone;
}

/** Resolve icon + tone for a type. Pure data; UI applies the actual classes. */
export function getNotificationVisual(type: NotificationType): NotificationVisual {
    switch (type) {
        case 'PAYMENT_CONFIRMED':
            return { icon: 'payment-success', tone: 'success' };
        case 'PAYMENT_REJECTED':
            return { icon: 'payment-fail', tone: 'critical' };
        case 'ORDER_QTY_CHANGED':
            return { icon: 'order-edit', tone: 'accent' };
        case 'ORDER_LINE_DELETED':
            return { icon: 'order-remove', tone: 'warning' };
        case 'ORDER_CLEARED':
            return { icon: 'order-remove', tone: 'warning' };
        case 'ORDER_HANDOFF_STATUS':
            return { icon: 'handoff', tone: 'accent' };
        case 'PURCHASE_FULFILLMENT_STAGE':
            return { icon: 'stage', tone: 'neutral' };
        case 'PURCHASE_STATUS_CHANGED':
            return { icon: 'status', tone: 'neutral' };
    }
}

/**
 * A single labeled detail shown in the structured card. `label` is a short
 * Russian noun (Сумма, Товар, Количество, Закупка), `value` is the formatted
 * value. The UI renders these as rows under the title — much easier to scan
 * than a flat sentence.
 */
export interface NotificationField {
    label: string;
    value: string;
}

/**
 * Structured detail rows for the notification card. Each type surfaces the
 * fields that explain "what exactly happened" — amount for payments, product +
 * qty for order changes, stage label for fulfillment transitions.
 *
 * `purchaseTag` is always the first field so the user can identify the
 * purchase at a glance; subsequent fields depend on the type.
 */
export function getNotificationFields<T extends NotificationType>(
    type: T,
    payload: NotificationPayload<T>,
): NotificationField[] {
    const fields: NotificationField[] = [];
    const addTag = (tag: string) => fields.push({ label: 'Закупка', value: formatTag(tag) });

    switch (type) {
        case 'PAYMENT_CONFIRMED': {
            const p = payload as NotificationPayload<'PAYMENT_CONFIRMED'>;
            addTag(p.purchaseTag);
            fields.push({ label: 'Сумма', value: formatAmount(p.amount) });
            if (p.adminNote) fields.push({ label: 'Комментарий', value: p.adminNote });
            break;
        }
        case 'PAYMENT_REJECTED': {
            const p = payload as NotificationPayload<'PAYMENT_REJECTED'>;
            addTag(p.purchaseTag);
            fields.push({ label: 'Сумма', value: formatAmount(p.amount) });
            if (p.adminNote) fields.push({ label: 'Причина', value: p.adminNote });
            break;
        }
        case 'ORDER_QTY_CHANGED': {
            const p = payload as NotificationPayload<'ORDER_QTY_CHANGED'>;
            addTag(p.purchaseTag);
            fields.push({ label: 'Товар', value: p.productLabel });
            // `prevQty` was added to the payload after launch; legacy rows don't
            // have it. Skip the "Было" row instead of crashing on undefined.
            if (Number.isFinite(p.prevQty as number | undefined)) {
                fields.push({
                    label: 'Было',
                    value: `${formatQtyLabel(p.prevQty)} ${p.unitShort}`,
                });
            }
            fields.push({
                label: 'Стало',
                value: `${formatQtyLabel(p.newQty)} ${p.unitShort}`,
            });
            break;
        }
        case 'ORDER_LINE_DELETED': {
            const p = payload as NotificationPayload<'ORDER_LINE_DELETED'>;
            addTag(p.purchaseTag);
            fields.push({ label: 'Товар', value: p.productLabel });
            break;
        }
        case 'ORDER_CLEARED': {
            const p = payload as NotificationPayload<'ORDER_CLEARED'>;
            addTag(p.purchaseTag);
            break;
        }
        case 'ORDER_HANDOFF_STATUS': {
            const p = payload as NotificationPayload<'ORDER_HANDOFF_STATUS'>;
            addTag(p.purchaseTag);
            fields.push({
                label: 'Статус',
                value: p.status == null ? HANDOFF_DEFAULT_LABEL : HANDOFF_STATUS_LABELS[p.status as HandoffStatus],
            });
            break;
        }
        case 'PURCHASE_FULFILLMENT_STAGE': {
            const p = payload as NotificationPayload<'PURCHASE_FULFILLMENT_STAGE'>;
            addTag(p.purchaseTag);
            fields.push({
                label: 'Новый этап',
                value: PURCHASE_FULFILLMENT_LABELS[p.stage as PurchaseFulfillmentStatus],
            });
            break;
        }
        case 'PURCHASE_STATUS_CHANGED': {
            const p = payload as NotificationPayload<'PURCHASE_STATUS_CHANGED'>;
            addTag(p.purchaseTag);
            fields.push({
                label: 'Новый статус',
                value: PURCHASE_STATUS_LABELS[p.status as PurchaseStatus],
            });
            break;
        }
    }

    return fields;
}

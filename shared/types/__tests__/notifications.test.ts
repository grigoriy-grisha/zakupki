import { describe, expect, it } from 'vitest';

import {
    COALESCABLE_NOTIFICATION_TYPES,
    COALESCE_DELIVERY_DELAY_MS,
    COALESCE_WINDOW_MS,
    getNotificationFields,
    getNotificationVisual,
    HANDOFF_DEFAULT_LABEL,
    HANDOFF_STATUS_LABELS,
    NOTIFIABLE_FULFILLMENT_STAGES,
    NOTIFICATION_TYPES,
    PURCHASE_FULFILLMENT_LABELS,
    PURCHASE_STATUS_LABELS,
    renderNotificationBody,
    renderNotificationTelegramBody,
    renderNotificationTitle,
    renderNotificationUrl,
} from '../src';

describe('NOTIFICATION_TYPES', () => {
    it('includes all 12 expected types', () => {
        expect(NOTIFICATION_TYPES).toEqual([
            'PAYMENT_CONFIRMED',
            'PAYMENT_REJECTED',
            'ORDER_QTY_CHANGED',
            'ORDER_LINE_DELETED',
            'ORDER_CLEARED',
            'ORDER_AMOUNT_RECALCULATED',
            'ORDER_HANDOFF_STATUS',
            'ORDER_ASSEMBLED',
            'ORDER_HANDOFF_STORED',
            'ORDER_HANDOFF_SHIP_REQUEST',
            'PURCHASE_FULFILLMENT_STAGE',
            'PURCHASE_STATUS_CHANGED',
        ]);
    });
});

describe('NOTIFIABLE_FULFILLMENT_STAGES', () => {
    it('contains only the 3 key user-facing stages', () => {
        expect([...NOTIFIABLE_FULFILLMENT_STAGES]).toEqual(['REORDER', 'PAYMENT', 'READY_FOR_PICKUP']);
    });

    it('rejects intermediate stages (no spam)', () => {
        expect(NOTIFIABLE_FULFILLMENT_STAGES.has('COLLECTION')).toBe(false);
        expect(NOTIFIABLE_FULFILLMENT_STAGES.has('SUPPLIER_ASSEMBLY')).toBe(false);
        expect(NOTIFIABLE_FULFILLMENT_STAGES.has('PACKAGING')).toBe(false);
        expect(NOTIFIABLE_FULFILLMENT_STAGES.has('IN_TRANSIT_RF')).toBe(false);
    });
});

describe('coalescing', () => {
    it('only ORDER_QTY_CHANGED is coalescable (admin editing burst)', () => {
        expect([...COALESCABLE_NOTIFICATION_TYPES]).toEqual(['ORDER_QTY_CHANGED']);
        // One-shot types must never be coalesced — coalescing a payment confirm
        // with a reject would silently drop the rejection.
        expect(COALESCABLE_NOTIFICATION_TYPES.has('PAYMENT_CONFIRMED')).toBe(false);
        expect(COALESCABLE_NOTIFICATION_TYPES.has('PAYMENT_REJECTED')).toBe(false);
        expect(COALESCABLE_NOTIFICATION_TYPES.has('ORDER_LINE_DELETED')).toBe(false);
        expect(COALESCABLE_NOTIFICATION_TYPES.has('PURCHASE_STATUS_CHANGED')).toBe(false);
    });

    it('coalesce window is 2 minutes — covers an editing burst but not two separate sessions', () => {
        // Too short = every click is a new notification (defeats the purpose).
        // Too long = two unrelated admin sessions merge confusingly.
        expect(COALESCE_WINDOW_MS).toBeGreaterThanOrEqual(60_000);
        expect(COALESCE_WINDOW_MS).toBeLessThanOrEqual(5 * 60_000);
    });

    it('delivery delay is within 10–120s — short enough to feel responsive, long enough to absorb a burst', () => {
        // < 10s = barely absorbs typing 15→20→25→30 fast enough.
        // > 120s = user thinks the notification is lost.
        expect(COALESCE_DELIVERY_DELAY_MS).toBeGreaterThanOrEqual(10_000);
        expect(COALESCE_DELIVERY_DELAY_MS).toBeLessThanOrEqual(120_000);
    });

    it('coalesce window is strictly greater than the delivery delay', () => {
        // If the delay were >= the window, a delayed job could fire after the
        // candidate row aged out of findRecentUndelivered, breaking the merge.
        // The window must give the row enough headroom to still be found while
        // the debounced job is waiting.
        expect(COALESCE_WINDOW_MS).toBeGreaterThan(COALESCE_DELIVERY_DELAY_MS);
    });

    it('ORDER_QTY_CHANGED payload carries purchaseItemId — the coalesce key', () => {
        // The coalesce key must be part of the typed payload so the service can
        // read it without casting. If this contract breaks, coalescing silently
        // stops working.
        const payload: import('../src').NotificationPayload<'ORDER_QTY_CHANGED'> = {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 42,
            productLabel: 'Сахар',
            prevQty: 2,
            newQty: 5,
            unitShort: 'шт',
        };
        expect(payload.purchaseItemId).toBe(42);
    });
});

describe('renderNotificationTitle', () => {
    it.each([
        ['PAYMENT_CONFIRMED', 'Оплата подтверждена'],
        ['PAYMENT_REJECTED', 'Оплата отклонена'],
        ['ORDER_QTY_CHANGED', 'Заказ изменён'],
        ['ORDER_LINE_DELETED', 'Позиция удалена'],
        ['ORDER_CLEARED', 'Заказ очищен'],
        ['ORDER_HANDOFF_STATUS', 'Статус заказа обновлён'],
        ['PURCHASE_FULFILLMENT_STAGE', 'Этап закупки обновлён'],
        ['PURCHASE_STATUS_CHANGED', 'Статус закупки обновлён'],
    ] as const)('returns Russian title for %s', (type, expected) => {
        expect(renderNotificationTitle(type)).toBe(expected);
    });
});

describe('renderNotificationBody', () => {
    it('PAYMENT_CONFIRMED — includes amount, tag, and optional adminNote', () => {
        const body = renderNotificationBody('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: 'SUMMER2026',
            amount: 1500,
            adminNote: 'Зачислено',
        });
        expect(body).toContain('#SUMMER2026');
        expect(body).toContain('1500 ₽');
        expect(body).toContain('Зачислено');
    });

    it('PAYMENT_CONFIRMED — without adminNote omits the note line', () => {
        const body = renderNotificationBody('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: 'X',
            amount: 1500,
            adminNote: null,
        });
        expect(body).not.toContain('Комментарий');
    });

    it('PAYMENT_REJECTED — labels the rejection reason distinctly from confirm', () => {
        const body = renderNotificationBody('PAYMENT_REJECTED', {
            purchaseId: 1,
            purchaseTag: 'X',
            amount: 999.5,
            adminNote: 'Не хватает чека',
        });
        expect(body).toContain('отклонена');
        expect(body).toContain('999.50 ₽');
        expect(body).toContain('Причина');
        expect(body).toContain('Не хватает чека');
    });

    it('ORDER_QTY_CHANGED — formats integer qty without decimals', () => {
        const body = renderNotificationBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            prevQty: 2,
            newQty: 5,
            unitShort: 'шт',
        });
        expect(body).toContain('«Сахар»');
        expect(body).toContain('было 2 шт');
        expect(body).toContain('стало 5 шт');
    });

    it('ORDER_QTY_CHANGED — formats fractional qty with up to 3 decimals', () => {
        const body = renderNotificationBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Мука',
            prevQty: 1,
            newQty: 0.5,
            unitShort: 'кг',
        });
        expect(body).toContain('стало 0.5 кг');
    });

    it('ORDER_QTY_CHANGED — omits "было" when prevQty is missing (legacy payload)', () => {
        const body = renderNotificationBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            newQty: 5,
            unitShort: 'шт',
        } as Record<string, unknown>);
        expect(body).not.toContain('было');
        expect(body).toContain('стало 5 шт');
    });

    it('ORDER_LINE_DELETED — references the product label', () => {
        const body = renderNotificationBody('ORDER_LINE_DELETED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Кофе',
        });
        expect(body).toContain('«Кофе»');
        expect(body).toContain('удалил');
    });

    it('ORDER_CLEARED — mentions the purchase', () => {
        const body = renderNotificationBody('ORDER_CLEARED', { purchaseId: 1, purchaseTag: 'BIG' });
        expect(body).toContain('#BIG');
        expect(body).toContain('очистил');
    });

    it('ORDER_HANDOFF_STATUS — uses the canonical handoff label', () => {
        const body = renderNotificationBody('ORDER_HANDOFF_STATUS', {
            purchaseId: 1,
            purchaseTag: 'X',
            status: 'SENT',
        });
        expect(body).toContain('#X');
        expect(body).toContain(HANDOFF_STATUS_LABELS.SENT);
    });

    it('ORDER_HANDOFF_STATUS — reset to null says the status was сброшен', () => {
        const body = renderNotificationBody('ORDER_HANDOFF_STATUS', {
            purchaseId: 1,
            purchaseTag: 'X',
            status: null,
        });
        expect(body).toContain('сброшен');
        expect(body).not.toContain(HANDOFF_DEFAULT_LABEL);
    });

    it('PURCHASE_FULFILLMENT_STAGE — uses the canonical fulfillment label', () => {
        const body = renderNotificationBody('PURCHASE_FULFILLMENT_STAGE', {
            purchaseId: 1,
            purchaseTag: 'X',
            stage: 'PAYMENT',
        });
        expect(body).toContain(PURCHASE_FULFILLMENT_LABELS.PAYMENT);
    });

    it('PURCHASE_STATUS_CHANGED — uses the canonical purchase status label', () => {
        const body = renderNotificationBody('PURCHASE_STATUS_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            status: 'DONE',
        });
        expect(body).toContain(PURCHASE_STATUS_LABELS.DONE);
    });
});

describe('renderNotificationTelegramBody', () => {
    it('emits a bold headline + the purchase tag', () => {
        const body = renderNotificationTelegramBody('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: '#SUMMER',
            amount: 1500,
        });
        // Bolded title as the first line, no leading emoji.
        expect(body.startsWith('<b>Оплата подтверждена</b>')).toBe(true);
        // Purchase tag rendered as a single # (not ##), and the line is present.
        expect(body).toContain('Закупка #SUMMER');
        expect(body).not.toContain('##SUMMER');
    });

    it('adds a # prefix when the stored tag does not include one', () => {
        const body = renderNotificationTelegramBody('ORDER_CLEARED', {
            purchaseId: 1,
            purchaseTag: 'BIG',
        });
        expect(body).toContain('#BIG');
        expect(body).not.toContain('##');
    });

    it('renders Сумма + Комментарий as bold-labeled rows for confirmed payments', () => {
        const body = renderNotificationTelegramBody('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: '#X',
            amount: 1500,
            adminNote: 'Зачислено',
        });
        expect(body).toContain('<b>Сумма:</b> 1500 ₽');
        expect(body).toContain('<b>Комментарий:</b> Зачислено');
    });

    it('uses "Причина" (not "Комментарий") as the label for rejected payments', () => {
        const body = renderNotificationTelegramBody('PAYMENT_REJECTED', {
            purchaseId: 1,
            purchaseTag: '#X',
            amount: 999.5,
            adminNote: 'Не хватает чека',
        });
        expect(body).toContain('<b>Причина:</b>');
        expect(body).not.toContain('Комментарий');
        expect(body).toContain('999.50 ₽');
    });

    it('shows Было + Стало rows for ORDER_QTY_CHANGED when prevQty is present', () => {
        const body = renderNotificationTelegramBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: '#X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            prevQty: 2,
            newQty: 5,
            unitShort: 'шт',
        });
        expect(body).toContain('<b>Товар:</b> Сахар');
        expect(body).toContain('<b>Было:</b> 2 шт');
        expect(body).toContain('<b>Стало:</b> 5 шт');
    });

    it('omits the Было row for legacy ORDER_QTY_CHANGED rows without prevQty', () => {
        const body = renderNotificationTelegramBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: '#X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            newQty: 5,
            unitShort: 'шт',
        } as Record<string, unknown>);
        expect(body).not.toContain('Было');
        expect(body).toContain('<b>Стало:</b> 5 шт');
    });

    it('renders the correct bold headline per type (no leading emoji)', () => {
        const qty = renderNotificationTelegramBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: '#X',
            purchaseItemId: 10,
            productLabel: 'X',
            prevQty: 1,
            newQty: 2,
            unitShort: 'шт',
        });
        expect(qty.startsWith('<b>Заказ изменён</b>')).toBe(true);

        const del = renderNotificationTelegramBody('ORDER_LINE_DELETED', {
            purchaseId: 1,
            purchaseTag: '#X',
            purchaseItemId: 10,
            productLabel: 'X',
        });
        expect(del.startsWith('<b>Позиция удалена</b>')).toBe(true);
    });

    it('escapes HTML-unsafe characters in user-supplied fields', () => {
        // Product name with < and & — must not leak through as raw markup,
        // or Telegram rejects the message and the worker swallows the DM.
        const body = renderNotificationTelegramBody('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: '#X',
            purchaseItemId: 10,
            productLabel: 'Чай & <кофе>',
            prevQty: 1,
            newQty: 2,
            unitShort: 'шт',
        });
        expect(body).toContain('Чай &amp; &lt;кофе&gt;');
        expect(body).not.toContain('Чай & <кофе>');
    });

    it('keeps the markup tags intact (not double-escaped)', () => {
        const body = renderNotificationTelegramBody('ORDER_CLEARED', {
            purchaseId: 1,
            purchaseTag: '#X',
        });
        expect(body).toContain('<b>');
        expect(body).not.toContain('&lt;b&gt;');
    });

    it('renders the stage label for PURCHASE_FULFILLMENT_STAGE', () => {
        const body = renderNotificationTelegramBody('PURCHASE_FULFILLMENT_STAGE', {
            purchaseId: 1,
            purchaseTag: '#X',
            stage: 'PAYMENT',
        });
        expect(body.startsWith('<b>Этап закупки обновлён</b>')).toBe(true);
        expect(body).toContain('<b>Новый этап:</b>');
        expect(body).toContain(PURCHASE_FULFILLMENT_LABELS.PAYMENT);
    });

    it('renders the status label for PURCHASE_STATUS_CHANGED', () => {
        const body = renderNotificationTelegramBody('PURCHASE_STATUS_CHANGED', {
            purchaseId: 1,
            purchaseTag: '#X',
            status: 'DONE',
        });
        expect(body.startsWith('<b>Статус закупки обновлён</b>')).toBe(true);
        expect(body).toContain('<b>Новый статус:</b>');
        expect(body).toContain(PURCHASE_STATUS_LABELS.DONE);
    });

    it('renders the handoff label for ORDER_HANDOFF_STATUS', () => {
        const body = renderNotificationTelegramBody('ORDER_HANDOFF_STATUS', {
            purchaseId: 1,
            purchaseTag: '#X',
            status: 'RECEIVED',
        });
        expect(body.startsWith('<b>Статус заказа обновлён</b>')).toBe(true);
        expect(body).toContain(`<b>Статус:</b> ${HANDOFF_STATUS_LABELS.RECEIVED}`);
    });

    it('renders the default label for a reset handoff status', () => {
        const body = renderNotificationTelegramBody('ORDER_HANDOFF_STATUS', {
            purchaseId: 1,
            purchaseTag: '#X',
            status: null,
        });
        expect(body).toContain(`<b>Статус:</b> ${HANDOFF_DEFAULT_LABEL}`);
    });
});

describe('renderNotificationUrl', () => {
    it('routes payment notifications to /shop/orders', () => {
        expect(
            renderNotificationUrl('PAYMENT_CONFIRMED', { purchaseId: 7, purchaseTag: 'X', amount: 1 }),
        ).toBe('/shop/orders');
        expect(
            renderNotificationUrl('PAYMENT_REJECTED', { purchaseId: 7, purchaseTag: 'X', amount: 1 }),
        ).toBe('/shop/orders');
    });

    it('routes handoff notifications to /shop/orders — the participant sees the status there', () => {
        expect(
            renderNotificationUrl('ORDER_HANDOFF_STATUS', { purchaseId: 7, purchaseTag: 'X', status: 'SENT' }),
        ).toBe('/shop/orders');
    });

    it('deep-links order-change notifications to the purchase page', () => {
        expect(
            renderNotificationUrl('ORDER_QTY_CHANGED', {
                purchaseId: 42,
                purchaseTag: 'X',
                purchaseItemId: 10,
                productLabel: 'A',
                prevQty: 1,
                newQty: 1,
                unitShort: 'шт',
            }),
        ).toBe('/shop/purchase/42');
        expect(
            renderNotificationUrl('ORDER_LINE_DELETED', {
                purchaseId: 42,
                purchaseTag: 'X',
                purchaseItemId: 10,
                productLabel: 'A',
            }),
        ).toBe('/shop/purchase/42');
        expect(renderNotificationUrl('ORDER_CLEARED', { purchaseId: 42, purchaseTag: 'X' })).toBe(
            '/shop/purchase/42',
        );
    });

    it('deep-links purchase-lifecycle notifications to the purchase page', () => {
        expect(
            renderNotificationUrl('PURCHASE_FULFILLMENT_STAGE', { purchaseId: 9, purchaseTag: 'X', stage: 'PAYMENT' }),
        ).toBe('/shop/purchase/9');
        expect(
            renderNotificationUrl('PURCHASE_STATUS_CHANGED', { purchaseId: 9, purchaseTag: 'X', status: 'DONE' }),
        ).toBe('/shop/purchase/9');
    });
});

describe('getNotificationVisual', () => {
    it.each([
        ['PAYMENT_CONFIRMED', 'success'],
        ['PAYMENT_REJECTED', 'critical'],
        ['ORDER_QTY_CHANGED', 'accent'],
        ['ORDER_LINE_DELETED', 'warning'],
        ['ORDER_CLEARED', 'warning'],
        ['ORDER_HANDOFF_STATUS', 'accent'],
        ['PURCHASE_FULFILLMENT_STAGE', 'neutral'],
        ['PURCHASE_STATUS_CHANGED', 'neutral'],
    ] as const)('returns tone %s for %s', (type, expectedTone) => {
        const visual = getNotificationVisual(type);
        expect(visual.tone).toBe(expectedTone);
        // icon must be a valid kind so the UI can look it up
        expect(visual.icon).toBeTruthy();
    });

    it('distinguishes payment success from failure by tone', () => {
        expect(getNotificationVisual('PAYMENT_CONFIRMED').tone).not.toBe(
            getNotificationVisual('PAYMENT_REJECTED').tone,
        );
    });
});

describe('getNotificationFields', () => {
    it('PAYMENT_CONFIRMED — surfaces Закупка, Сумма, optional Комментарий', () => {
        const fields = getNotificationFields('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: 'X',
            amount: 1500,
            adminNote: 'Ок',
        });
        expect(fields).toEqual([
            { label: 'Закупка', value: '#X' },
            { label: 'Сумма', value: '1500 ₽' },
            { label: 'Комментарий', value: 'Ок' },
        ]);
    });

    it('PAYMENT_CONFIRMED — skips Комментарий when adminNote is absent', () => {
        const fields = getNotificationFields('PAYMENT_CONFIRMED', {
            purchaseId: 1,
            purchaseTag: 'X',
            amount: 1500,
        });
        expect(fields.find((f) => f.label === 'Комментарий')).toBeUndefined();
    });

    it('PAYMENT_REJECTED — labels the note as Причина (not Комментарий)', () => {
        const fields = getNotificationFields('PAYMENT_REJECTED', {
            purchaseId: 1,
            purchaseTag: 'X',
            amount: 500,
            adminNote: 'Чек не виден',
        });
        expect(fields.find((f) => f.label === 'Причина')?.value).toBe('Чек не виден');
        expect(fields.find((f) => f.label === 'Комментарий')).toBeUndefined();
    });

    it('ORDER_QTY_CHANGED — surfaces Товар, Было and Стало with unit', () => {
        const fields = getNotificationFields('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            prevQty: 2,
            newQty: 5,
            unitShort: 'шт',
        });
        expect(fields).toContainEqual({ label: 'Товар', value: 'Сахар' });
        expect(fields).toContainEqual({ label: 'Было', value: '2 шт' });
        expect(fields).toContainEqual({ label: 'Стало', value: '5 шт' });
    });

    it('ORDER_QTY_CHANGED — skips Было when prevQty is missing (legacy payload)', () => {
        const fields = getNotificationFields('ORDER_QTY_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Сахар',
            newQty: 5,
            unitShort: 'шт',
        } as Record<string, unknown>);
        expect(fields.find((f) => f.label === 'Было')).toBeUndefined();
        expect(fields).toContainEqual({ label: 'Стало', value: '5 шт' });
    });

    it('ORDER_LINE_DELETED — surfaces only Закупка + Товар', () => {
        const fields = getNotificationFields('ORDER_LINE_DELETED', {
            purchaseId: 1,
            purchaseTag: 'X',
            purchaseItemId: 10,
            productLabel: 'Кофе',
        });
        expect(fields).toEqual([
            { label: 'Закупка', value: '#X' },
            { label: 'Товар', value: 'Кофе' },
        ]);
    });

    it('ORDER_CLEARED — surfaces only Закупка', () => {
        const fields = getNotificationFields('ORDER_CLEARED', { purchaseId: 1, purchaseTag: 'BIG' });
        expect(fields).toEqual([{ label: 'Закупка', value: '#BIG' }]);
    });

    it('PURCHASE_FULFILLMENT_STAGE — uses the canonical fulfillment label', () => {
        const fields = getNotificationFields('PURCHASE_FULFILLMENT_STAGE', {
            purchaseId: 1,
            purchaseTag: 'X',
            stage: 'PAYMENT',
        });
        expect(fields).toContainEqual({ label: 'Новый этап', value: PURCHASE_FULFILLMENT_LABELS.PAYMENT });
    });

    it('PURCHASE_STATUS_CHANGED — uses the canonical purchase status label', () => {
        const fields = getNotificationFields('PURCHASE_STATUS_CHANGED', {
            purchaseId: 1,
            purchaseTag: 'X',
            status: 'DONE',
        });
        expect(fields).toContainEqual({ label: 'Новый статус', value: PURCHASE_STATUS_LABELS.DONE });
    });

    it('ORDER_HANDOFF_STATUS — surfaces the handoff label', () => {
        const fields = getNotificationFields('ORDER_HANDOFF_STATUS', {
            purchaseId: 1,
            purchaseTag: 'X',
            status: 'STORED',
        });
        expect(fields).toEqual([
            { label: 'Закупка', value: '#X' },
            { label: 'Статус', value: HANDOFF_STATUS_LABELS.STORED },
        ]);
    });

    it('always puts Закупка first so the purchase is identifiable at a glance', () => {
        // Minimal valid payload per type — fields() reads only what it needs.
        const minimalPayloads: Record<NotificationType, Record<string, unknown>> = {
            PAYMENT_CONFIRMED: { purchaseId: 1, purchaseTag: 'T', amount: 1 },
            PAYMENT_REJECTED: { purchaseId: 1, purchaseTag: 'T', amount: 1 },
            ORDER_QTY_CHANGED: {
                purchaseId: 1,
                purchaseTag: 'T',
                purchaseItemId: 1,
                productLabel: 'P',
                prevQty: 0,
                newQty: 1,
                unitShort: 'шт',
            },
            ORDER_LINE_DELETED: { purchaseId: 1, purchaseTag: 'T', purchaseItemId: 1, productLabel: 'P' },
            ORDER_CLEARED: { purchaseId: 1, purchaseTag: 'T' },
            ORDER_AMOUNT_RECALCULATED: { purchaseId: 1, purchaseTag: 'T', prevAmountDue: 100, newAmountDue: 120 },
            ORDER_HANDOFF_STATUS: { purchaseId: 1, purchaseTag: 'T', status: 'SENT' },
            ORDER_ASSEMBLED: { purchaseId: 1, purchaseTag: 'T', purchaseOrderId: 1 },
            ORDER_HANDOFF_STORED: { purchaseId: 1, purchaseTag: 'T' },
            ORDER_HANDOFF_SHIP_REQUEST: { purchaseId: 1, purchaseTag: 'T' },
            PURCHASE_FULFILLMENT_STAGE: { purchaseId: 1, purchaseTag: 'T', stage: 'PAYMENT' },
            PURCHASE_STATUS_CHANGED: { purchaseId: 1, purchaseTag: 'T', status: 'DONE' },
        };

        for (const type of NOTIFICATION_TYPES) {
            const fields = getNotificationFields(type, minimalPayloads[type] as never);
            expect(fields[0]?.label).toBe('Закупка');
            expect(fields[0]?.value).toMatch(/^#T$/);
        }
    });
});

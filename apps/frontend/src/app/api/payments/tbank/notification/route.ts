import { createLogger } from '@zakupki/logger';

import { serviceContainer } from '@/server/lib/service-container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = createLogger('tbank-webhook');

/**
 * Уведомления Т-Банка о смене статуса платежа (NotificationURL).
 * Банк ждёт ответ `OK` с HTTP 200, иначе повторяет уведомление.
 */
export async function POST(request: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return new Response('Bad Request', { status: 400 });
    }

    try {
        const ok = await serviceContainer.onlinePayment.handleNotification(body);
        if (!ok) return new Response('Invalid token', { status: 403 });
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } catch (err) {
        log.error({ err, orderId: body.OrderId, status: body.Status }, 'tbank notification failed');
        // Не OK → банк повторит уведомление позже.
        return new Response('Error', { status: 500 });
    }
}

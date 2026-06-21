/**
 * Callback-data wire format: `prefix:action[:id]`.
 *
 * Парсинг и построение инкапсулированы в CallbackParser / Callbacks builder,
 * чтобы handlers не возились с string-splitting и не могли собрать опечатку.
 *
 * Wire contract — НЕ менять. Format `orders:pick:{id}` и пр. остаётся байт-идентичным.
 */

export type CallbackAction =
    | { kind: 'orders:list' }
    | { kind: 'orders:noop' }
    | { kind: 'orders:pick'; purchaseId: number }
    | { kind: 'pay:pick'; purchaseId: number }
    | { kind: 'pay:all'; purchaseId: number };

/** Все известные префиксы callback-data (для регистрации dispatcher'а). */
export const CALLBACK_PREFIXES = ['orders:', 'pay:'] as const;
export type CallbackPrefix = (typeof CALLBACK_PREFIXES)[number];

export class CallbackParser {
    /** Парсит строку из Telegram в типизированный CallbackAction. Возвращает null при ошибке. */
    static parse(data: string): CallbackAction | null {
        if (data === 'orders:list') return { kind: 'orders:list' };
        if (data === 'orders:noop') return { kind: 'orders:noop' };

        const ordersPickMatch = /^orders:pick:(\d+)$/.exec(data);
        if (ordersPickMatch) {
            const purchaseId = Number(ordersPickMatch[1]);
            if (Number.isFinite(purchaseId)) return { kind: 'orders:pick', purchaseId };
        }

        const payPickMatch = /^pay:pick:(\d+)$/.exec(data);
        if (payPickMatch) {
            const purchaseId = Number(payPickMatch[1]);
            if (Number.isFinite(purchaseId)) return { kind: 'pay:pick', purchaseId };
        }

        const payAllMatch = /^pay:all:(\d+)$/.exec(data);
        if (payAllMatch) {
            const purchaseId = Number(payAllMatch[1]);
            if (Number.isFinite(purchaseId)) return { kind: 'pay:all', purchaseId };
        }

        return null;
    }

    /** Собирает строку из CallbackAction (для построения inline_keyboard). */
    static build(action: CallbackAction): string {
        switch (action.kind) {
            case 'orders:list':
                return 'orders:list';
            case 'orders:noop':
                return 'orders:noop';
            case 'orders:pick':
                return `orders:pick:${action.purchaseId}`;
            case 'pay:pick':
                return `pay:pick:${action.purchaseId}`;
            case 'pay:all':
                return `pay:all:${action.purchaseId}`;
        }
    }
}

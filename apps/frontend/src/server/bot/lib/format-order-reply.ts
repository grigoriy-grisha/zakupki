import { countFullSupplierPacks, getPackDiscountPricingInfo } from '@zakupki/types';

import type { OrderCollectionAction, OrderCollectionResult } from '../services/order-collection.service';
import { escapeHtml } from './html';

function fmt(value: number): string {
    return value.toLocaleString('ru-RU');
}

/**
 * Форматирует результат операции заказа в текстовое сообщение для Telegram.
 *
 * Примеры:
 *   ✅ Название товара
 *   +10 гр → Итого: 50 гр · 1 700 ₽
 *
 *   ✅ Название товара
 *   +1 упак. → Итого: 1 упак. · 3 000 ₽
 *
 *   ❌ Заказ отменён — Название товара
 */
export function formatOrderReply(
    result: Extract<OrderCollectionResult, { ok: true }>,
    packDiscountPercent: number,
): string {
    if (result.cancelled) {
        return `❌ Заказ отменён — ${escapeHtml(result.productName)}`;
    }

    const lines: string[] = [];
    lines.push(`✅ ${escapeHtml(result.productName)}`);

    // Что сделали
    if (result.added) {
        lines.push(formatAction('+', result.added, result.unitShort, result.packSize));
    } else if (result.subtracted) {
        lines.push(formatAction('−', result.subtracted, result.unitShort, result.packSize));
    }

    // Итого
    lines.push('');
    const parts: string[] = [];

    if (result.quantity > 0) {
        parts.push(`${fmt(result.quantity)} ${escapeHtml(result.unitShort)}`);
    }
    if (result.packageCount > 0) {
        parts.push(`${result.packageCount} упак.`);
    }

    const quantityLabel = parts.length > 0 ? parts.join(' + ') : '0';
    lines.push(`💰 Итого: ${quantityLabel} · ${fmt(result.amountDue)} ₽`);

    // Скидка за целые пачки (pack discount)
    if (result.packSize != null && result.packSize > 0 && packDiscountPercent > 0) {
        const product = {
            supplierPackageAmount: result.packSize,
            supplierPackageUnit: 'гр',
            supplierPackagePrice: result.packagePrice,
        };
        const discountInfo = getPackDiscountPricingInfo(product, packDiscountPercent);
        if (discountInfo != null) {
            const fullPacks = countFullSupplierPacks(result.quantity, discountInfo.packSize);
            if (fullPacks > 0) {
                const packWord = fullPacks === 1 ? 'пачку' : fullPacks < 5 ? 'пачки' : 'пачек';
                lines.push(`🎁 Скидка за ${fullPacks} ${packWord}!`);
            }
        }
    }

    return lines.join('\n');
}

function formatAction(
    sign: '+' | '−',
    action: OrderCollectionAction,
    unitShort: string,
    packSize: number | null,
): string {
    if (action.unit === 'packs') {
        const packLabel = packSize != null ? ` (${fmt(packSize)} ${escapeHtml(unitShort)})` : '';
        return `${sign}${action.amount} упак.${packLabel}`;
    }
    return `${sign}${fmt(action.amount)} ${escapeHtml(unitShort)}`;
}

import { roundMoney } from '@zakupki/types';

/** Строка заказа клиента: что купил и из чего сложилась её сумма. */
export type PaymentBreakdownLine = {
    /** Название товара для чека, уже с количеством («Miyuki DB-0031 — 25 гр»). */
    name: string;
    amountDue: number;
    /** Цена поставщика (товар без наценок). null — у строки нет расшифровки, вся сумма идёт как товар. */
    base: number | null;
    delivery: number;
    org: number;
};

export type PaymentBreakdownItem = {
    kind: 'goods' | 'delivery' | 'org' | 'fee';
    name: string;
    amount: number;
};

export type PaymentBreakdown = {
    items: PaymentBreakdownItem[];
    /** Сумма товаров / доставки / оргсбора в этом платеже (после скидки и с учётом частичной оплаты). */
    goods: number;
    delivery: number;
    org: number;
    fee: number;
    discount: number;
    /** Платёж покрывает только часть заказа. */
    partial: boolean;
    /** Короткое описание для банка (поле Description, до 140 символов). */
    description: string;
};

/** У Т-Банка в чеке не больше 100 позиций; оставляем место под доставку, оргсбор и комиссию. */
const MAX_GOODS_ITEMS = 90;
const DESCRIPTION_MAX = 140;

export function formatReceiptRub(value: number): string {
    const text = value.toLocaleString('ru-RU', {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
    // Узкие неразрывные пробелы из toLocaleString банк может показать квадратиками, а знак «₽»
    // в письмах Т-Банка превращается в «?» — пишем «руб.», как сам банк.
    return `${text.replace(/[\u00a0\u202f]/g, ' ')} руб.`;
}

/**
 * Раскладывает платёж клиента на позиции чека: каждый товар по цене поставщика, отдельно
 * доставка, оргсбор и комиссия банка. Если платёж частичный или со скидкой, все позиции
 * уменьшаются пропорционально, а копейки округления уходят в самую крупную позицию —
 * сумма позиций всегда равна оплате до копейки.
 */
export function buildPaymentBreakdown(params: {
    tag: string;
    lines: readonly PaymentBreakdownLine[];
    /** Сумма заказа целиком. */
    due: number;
    /** Сколько из заказа закрывает этот платёж (до скидки). */
    amount: number;
    discount: number;
    fee: number;
}): PaymentBreakdown {
    const net = roundMoney(params.amount - params.discount);
    const fee = roundMoney(params.fee);
    const lines = params.lines.filter((l) => l.amountDue > 0);
    const linesSum = roundMoney(lines.reduce((s, l) => s + l.amountDue, 0));
    const partial = roundMoney(params.amount) < roundMoney(params.due);

    // Без строк (или если они не сходятся с суммой) — одна позиция на весь платёж, как раньше.
    if (lines.length === 0 || linesSum <= 0) {
        const items: PaymentBreakdownItem[] = [{ kind: 'goods', name: `Заказ по закупке ${params.tag}`, amount: net }];
        if (fee > 0) items.push({ kind: 'fee', name: 'Комиссия банка за онлайн-оплату', amount: fee });
        return finish({ ...params, items, partial, discount: params.discount, net, fee });
    }

    const goodsRaw: { name: string; amount: number }[] = lines.map((l) => ({
        name: l.name,
        amount: l.base ?? l.amountDue,
    }));
    const deliveryRaw = lines.reduce((s, l) => s + (l.base == null ? 0 : l.delivery), 0);
    const orgRaw = lines.reduce((s, l) => s + (l.base == null ? 0 : l.org), 0);

    // Слишком много товаров — хвост сворачиваем в одну позицию.
    if (goodsRaw.length > MAX_GOODS_ITEMS) {
        const head = goodsRaw.slice(0, MAX_GOODS_ITEMS - 1);
        const tail = goodsRaw.slice(MAX_GOODS_ITEMS - 1);
        head.push({
            name: `Остальные товары (${tail.length} поз.)`,
            amount: tail.reduce((s, g) => s + g.amount, 0),
        });
        goodsRaw.splice(0, goodsRaw.length, ...head);
    }

    const raw: PaymentBreakdownItem[] = [
        ...goodsRaw.map((g) => ({ kind: 'goods' as const, name: g.name, amount: g.amount })),
        { kind: 'delivery', name: 'Доставка от поставщика', amount: deliveryRaw },
        { kind: 'org', name: 'Организационный сбор', amount: orgRaw },
    ];
    // Расшифровка может дать минус (копейки округления цены за грамм, сменённый оргсбор).
    // Позицию с минусом банк не примет, а если её выбросить — сумма чека разойдётся с оплатой.
    // Переносим минус в самую крупную позицию: общая сумма не меняется.
    const negative = raw.reduce((s, i) => s + Math.min(0, i.amount), 0);
    if (negative < 0) {
        for (const i of raw) if (i.amount < 0) i.amount = 0;
        const largest = raw.reduce((best, i) => (i.amount > best.amount ? i : best), raw[0]);
        largest.amount += negative;
    }
    const rawSum = raw.reduce((s, i) => s + i.amount, 0);
    const factor = rawSum > 0 ? net / rawSum : 0;
    const scaled = raw.map((i) => ({ ...i, amount: roundMoney(i.amount * factor) }));

    const diff = roundMoney(net - scaled.reduce((s, i) => s + i.amount, 0));
    if (diff !== 0) {
        const largest = scaled.reduce((best, i) => (i.amount > best.amount ? i : best), scaled[0]);
        largest.amount = roundMoney(largest.amount + diff);
    }

    const items = scaled.filter((i) => i.amount > 0);
    if (fee > 0) items.push({ kind: 'fee', name: 'Комиссия банка за онлайн-оплату', amount: fee });
    return finish({ ...params, items, partial, discount: params.discount, net, fee });
}

function finish(params: {
    tag: string;
    due: number;
    items: PaymentBreakdownItem[];
    partial: boolean;
    discount: number;
    net: number;
    fee: number;
}): PaymentBreakdown {
    const sumOf = (kind: PaymentBreakdownItem['kind']) =>
        roundMoney(params.items.filter((i) => i.kind === kind).reduce((s, i) => s + i.amount, 0));
    const goods = sumOf('goods');
    const delivery = sumOf('delivery');
    const org = sumOf('org');
    const goodsCount = params.items.filter((i) => i.kind === 'goods').length;

    return {
        items: params.items,
        goods,
        delivery,
        org,
        fee: params.fee,
        discount: roundMoney(params.discount),
        partial: params.partial,
        description: buildDescription({
            tag: params.tag,
            due: params.due,
            partial: params.partial,
            goods,
            goodsCount,
            delivery,
            org,
            fee: params.fee,
            discount: roundMoney(params.discount),
        }),
    };
}

function buildDescription(p: {
    tag: string;
    due: number;
    partial: boolean;
    goods: number;
    goodsCount: number;
    delivery: number;
    org: number;
    fee: number;
    discount: number;
}): string {
    const head = p.partial
        ? `Частичная оплата заказа ${p.tag} (заказ на ${formatReceiptRub(p.due)})`
        : `Оплата заказа ${p.tag}`;
    const parts = [
        `товары${p.goodsCount > 1 ? ` (${p.goodsCount} поз.)` : ''} ${formatReceiptRub(p.goods)}`,
        p.delivery > 0 ? `доставка ${formatReceiptRub(p.delivery)}` : null,
        p.org > 0 ? `оргсбор ${formatReceiptRub(p.org)}` : null,
        p.fee > 0 ? `комиссия банка ${formatReceiptRub(p.fee)}` : null,
        p.discount > 0 ? `скидка ${formatReceiptRub(p.discount)}` : null,
    ].filter((x): x is string => x != null);

    // Описание у банка ограничено 140 символами: если не влезает, убираем подробности с конца.
    let text = `${head}: ${parts.join(', ')}`;
    while (text.length > DESCRIPTION_MAX && parts.length > 1) {
        parts.pop();
        text = `${head}: ${parts.join(', ')}`;
    }
    return text.length > DESCRIPTION_MAX ? text.slice(0, DESCRIPTION_MAX) : text;
}

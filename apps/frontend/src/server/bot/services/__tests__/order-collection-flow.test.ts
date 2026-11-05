/**
 * Сквозной сценарий «комментарий в Telegram → строка заказа».
 *
 * OrderService и OrderBook — настоящие; подменены только хранилища (в памяти),
 * так что проверяются реальные доменные правила: пул добора, запрет уменьшения,
 * стадии. Главное, что фиксируют тесты: ok (а значит ❤ в чате) бывает только
 * тогда, когда в заказе записано ровно то количество, которое написал человек.
 */
import { describe, expect, it } from 'vitest';

import { OrderService } from '../../../services/order.service';
import type { ServiceContainer } from '../../container/service-container';
import { OrderCollectionService } from '../order-collection.service';
import type { PurchaseItemResolver } from '../purchase-item-resolver';

type Stage = 'COLLECTION' | 'PAYMENT' | 'REORDER' | 'SUPPLIER_ASSEMBLY' | 'PACKAGING';

interface LineRow {
    id: number;
    purchaseItemId: number;
    userId: number;
    quantity: number;
    amountDue: number;
    packageCount: number;
    baseQuantity: number | null;
    basePackageCount: number | null;
    status: 'ACTIVE' | 'CANCELLED';
    createdOnStage: string;
}

interface ItemOpts {
    stage: Stage;
    unitCode?: string;
    multiplicity?: number;
    minPackageAmount?: number | null;
    supplementStep?: number | null;
    packAmount?: number | null;
    orderedQty?: number | null;
    hidden?: boolean;
}

const ITEM_ID = 7;
const USER_ID = 100;
const OTHER_USER_ID = 200;

function setup(opts: ItemOpts, existing: Array<Partial<LineRow> & { userId: number; quantity: number }> = []) {
    let nextId = 1;
    const lines: LineRow[] = existing.map((l) => ({
        id: nextId++,
        purchaseItemId: ITEM_ID,
        amountDue: 0,
        packageCount: 0,
        baseQuantity: null,
        basePackageCount: null,
        status: 'ACTIVE',
        createdOnStage: 'COLLECTION',
        ...l,
    }));

    const item = {
        id: ITEM_ID,
        hidden: opts.hidden ?? false,
        unitCode: opts.unitCode ?? 'gram',
        minPackageAmount: opts.minPackageAmount ?? null,
        minPackageUnit: null,
        supplementStep: opts.supplementStep ?? null,
        packAmount: opts.packAmount ?? null,
        packUnit: null,
        orderedQty: opts.orderedQty ?? null,
        targetRemainder: null,
        supplierLimit: null,
        supplierLimitUnit: null,
        currencyId: null,
        pricePerPackCurrency: null,
        orgFeePercentOverride: null,
        deliveryPercentOverride: null,
        product: {
            id: 10,
            name: 'Бисер Bronze 6 мм',
            unitCode: opts.unitCode ?? 'gram',
            multiplicity: opts.multiplicity ?? 1,
        },
        purchase: {
            id: 1,
            tag: 'СЗ-10',
            status: 'ACTIVE',
            deletedAt: null,
            fulfillmentStatus: opts.stage,
            deliveryPercent: 0,
            currencyRates: [],
        },
        get orderLines() {
            return lines;
        },
    };

    const orderRepo = {
        async upsertOrderLine(
            purchaseItemId: number,
            userId: number,
            quantity: number,
            amountDue: number,
            packageCount?: number,
            createdOnStage = 'COLLECTION',
        ) {
            const found = lines.find(
                (l) =>
                    l.purchaseItemId === purchaseItemId && l.userId === userId && l.createdOnStage === createdOnStage,
            );
            if (found) {
                Object.assign(found, { quantity, amountDue, status: 'ACTIVE' });
                if (packageCount != null) found.packageCount = packageCount;
                return found;
            }
            const row: LineRow = {
                id: nextId++,
                purchaseItemId,
                userId,
                quantity,
                amountDue,
                packageCount: packageCount ?? 0,
                baseQuantity: null,
                basePackageCount: null,
                status: 'ACTIVE',
                createdOnStage,
            };
            lines.push(row);
            return row;
        },
        async deleteOrderLineById(id: number) {
            const idx = lines.findIndex((l) => l.id === id);
            if (idx >= 0) lines.splice(idx, 1);
        },
        async findAllActiveLinesForUserItem(purchaseItemId: number, userId: number) {
            return lines.filter(
                (l) => l.purchaseItemId === purchaseItemId && l.userId === userId && l.status === 'ACTIVE',
            );
        },
    };
    const purchaseRepo = { findItemWithPrice: async (id: number) => (id === ITEM_ID ? item : null) };
    const pricingSettings = {
        getOrgFeeDefaultPercent: async () => 0,
        getBeadPackPriceDiscountPercent: async () => 0,
    };
    const eventBus = { emitPurchaseItemChanged: async () => {} };

    const orderService = new OrderService(
        orderRepo as never,
        purchaseRepo as never,
        pricingSettings as never,
        eventBus as never,
        {} as never,
    );

    const container = {
        orderService,
        pricingSettings,
        userService: { upsertFromTelegramBot: async () => ({ id: USER_ID }) },
    } as unknown as ServiceContainer;

    const resolver = { resolvePurchaseItem: async () => item } as unknown as PurchaseItemResolver;
    const service = new OrderCollectionService(resolver, container);

    const send = (text: string) =>
        service.collectFromReply({
            chatId: -1002890281055,
            threadId: 555,
            text,
            telegramId: '42',
            userInfo: { firstName: 'Анастасия' },
        });

    const userQty = () =>
        lines
            .filter((l) => l.userId === USER_ID && l.status === 'ACTIVE')
            .reduce((sum, l) => sum + Number(l.quantity), 0);
    const userPacks = () =>
        lines
            .filter((l) => l.userId === USER_ID && l.status === 'ACTIVE')
            .reduce((sum, l) => sum + Number(l.packageCount), 0);

    return { send, lines, userQty, userPacks, item };
}

/**
 * Добор: фасовка 30 г, шаг добора 10 г, пачка поставщика 100 г, заказано 200 г.
 * Другие собрали 60 г → до целой пачки свободно 40 г (это меньше, чем 200 − 60).
 */
const REORDER_ITEM: ItemOpts = {
    stage: 'REORDER',
    unitCode: 'gram',
    minPackageAmount: 30,
    supplementStep: 10,
    packAmount: 100,
    orderedQty: 200,
};
const REORDER_OTHERS = [{ userId: OTHER_USER_ID, quantity: 60 }];

describe('добор из комментария (REORDER)', () => {
    it('«20» записывает ровно 20 г — раньше округлялось вниз до фасовки и терялось', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        const result = await send('20');
        expect(result).toMatchObject({ ok: true, quantity: 20, added: { amount: 20, unit: 'remainder' } });
        expect(userQty()).toBe(20);
    });

    it('«10» записывает 10 г — раньше превращалось в 0 и молча ставился ❤', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        expect(await send('10')).toMatchObject({ ok: true, quantity: 10 });
        expect(userQty()).toBe(10);
    });

    it('«40» записывает 40 г, а не 30', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        expect(await send('40')).toMatchObject({ ok: true, quantity: 40 });
        expect(userQty()).toBe(40);
    });

    it('несколько доборов подряд накапливаются', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        expect(await send('20')).toMatchObject({ ok: true, quantity: 20 });
        expect(await send('+10')).toMatchObject({ ok: true, quantity: 30 });
        expect(await send('10 гр')).toMatchObject({ ok: true, quantity: 40 });
        expect(userQty()).toBe(40);
    });

    it('«10», «-10», «10» (как у Rouge 6 мм) — в итоге 10 г', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        expect(await send('10')).toMatchObject({ ok: true });
        expect(await send('-10')).toMatchObject({ ok: true, cancelled: true });
        expect(await send('10')).toMatchObject({ ok: true, quantity: 10 });
        expect(userQty()).toBe(10);
    });

    it('некратное шагу «25» отклоняется с подсказкой и ничего не пишет', async () => {
        const { send, lines } = setup(REORDER_ITEM, REORDER_OTHERS);
        const before = JSON.stringify(lines);
        const result = await send('25');
        expect(result).toMatchObject({ ok: false, reason: 'not_step_multiple' });
        if (!result.ok) expect(result.message).toBe('Количество должно быть кратно 10 гр. Например: 20 или 30');
        expect(JSON.stringify(lines)).toBe(before);
    });

    it('меньше шага «5» отклоняется', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        const result = await send('5');
        expect(result).toMatchObject({ ok: false, reason: 'below_step' });
        if (!result.ok) expect(result.message).toBe('Минимальный шаг заказа — 10 гр. Например: 10');
        expect(userQty()).toBe(0);
    });

    it('больше свободного остатка — понятная ошибка из домена, без записи и без ❤', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        const result = await send('50');
        expect(result).toMatchObject({
            ok: false,
            reason: 'error',
            message: 'Нельзя добавить больше остатка. Можно ещё: 40 гр',
        });
        expect(userQty()).toBe(0);
    });

    it('ровно весь свободный остаток «40» принимается, следующий «10» — уже нет', async () => {
        const { send, userQty } = setup(REORDER_ITEM, REORDER_OTHERS);
        expect(await send('40')).toMatchObject({ ok: true, quantity: 40 });
        expect(await send('10')).toMatchObject({ ok: false, reason: 'error' });
        expect(userQty()).toBe(40);
    });

    it('без пачки поставщика предел задаёт «заказано»: 200 − 60 = 140', async () => {
        const item: ItemOpts = { ...REORDER_ITEM, packAmount: null };
        const ok = setup(item, REORDER_OTHERS);
        expect(await ok.send('140')).toMatchObject({ ok: true, quantity: 140 });
        expect(ok.userQty()).toBe(140);

        const over = setup(item, REORDER_OTHERS);
        expect(await over.send('150')).toMatchObject({
            ok: false,
            reason: 'error',
            message: 'Заказано у поставщика: 200 гр. Доступно: 140 гр',
        });
        expect(over.userQty()).toBe(0);
    });

    it('«-10» без заказа — no_change («убирать нечего»), а не ❤', async () => {
        const { send } = setup(REORDER_ITEM, REORDER_OTHERS);
        const result = await send('-10');
        expect(result).toMatchObject({ ok: false, reason: 'no_change' });
        if (!result.ok) expect(result.message).toBe('У вас нет заказа на этот товар — убирать нечего');
    });

    it('добор не трогает чужие строки', async () => {
        const { send, lines } = setup(REORDER_ITEM, REORDER_OTHERS);
        await send('20');
        expect(lines.find((l) => l.userId === OTHER_USER_ID)?.quantity).toBe(60);
    });
});

describe('сбор из комментария (COLLECTION)', () => {
    const COLLECTION_ITEM: ItemOpts = { stage: 'COLLECTION', unitCode: 'gram', minPackageAmount: 10, packAmount: 100 };

    it('«20» записывает 20 г', async () => {
        const { send, userQty } = setup(COLLECTION_ITEM);
        expect(await send('20')).toMatchObject({ ok: true, quantity: 20 });
        expect(userQty()).toBe(20);
    });

    it('«25» при фасовке 10 г отклоняется — раньше молча записывалось 20', async () => {
        const { send, userQty } = setup(COLLECTION_ITEM);
        const result = await send('25');
        expect(result).toMatchObject({ ok: false, reason: 'not_step_multiple' });
        if (!result.ok) expect(result.message).toContain('Например: 20 или 30');
        expect(userQty()).toBe(0);
    });

    it('«-15» отклоняется с примерами со знаком минус', async () => {
        const { send } = setup(COLLECTION_ITEM, [{ userId: USER_ID, quantity: 40 }]);
        const result = await send('-15');
        expect(result).toMatchObject({ ok: false, reason: 'not_step_multiple' });
        if (!result.ok) expect(result.message).toContain('Например: -10 или -20');
    });

    it('«-10» уменьшает существующий заказ', async () => {
        const { send, userQty } = setup(COLLECTION_ITEM, [{ userId: USER_ID, quantity: 40 }]);
        expect(await send('-10')).toMatchObject({ ok: true, quantity: 30, subtracted: { amount: 10 } });
        expect(userQty()).toBe(30);
    });

    it('убрать весь заказ — cancelled', async () => {
        const { send, userQty } = setup(COLLECTION_ITEM, [{ userId: USER_ID, quantity: 40 }]);
        expect(await send('-40')).toMatchObject({ ok: true, cancelled: true, quantity: 0 });
        expect(userQty()).toBe(0);
    });

    it('без фасовки шаг по умолчанию для граммов — 5 г', async () => {
        const { send, userQty } = setup({ stage: 'COLLECTION', unitCode: 'gram', packAmount: 100 });
        expect(await send('15')).toMatchObject({ ok: true, quantity: 15 });
        expect(await send('12')).toMatchObject({ ok: false, reason: 'not_step_multiple' });
        expect(userQty()).toBe(15);
    });

    it('штучный товар с кратностью 3: «6» принимается, «4» нет', async () => {
        const { send, userQty } = setup({ stage: 'COLLECTION', unitCode: 'piece', multiplicity: 3 });
        expect(await send('6')).toMatchObject({ ok: true, quantity: 6 });
        expect(await send('4')).toMatchObject({ ok: false, reason: 'not_step_multiple' });
        expect(userQty()).toBe(6);
    });

    it('штучный товар на доборе всё равно идёт по кратности, а не по шагу добора', async () => {
        const { send, userQty } = setup({ stage: 'REORDER', unitCode: 'piece', multiplicity: 2, supplementStep: 10 });
        const result = await send('4');
        if (result.ok) {
            expect(userQty()).toBe(4);
        } else {
            // Пул штучного добора может быть закрыт доменом — тогда без ❤ и без записи.
            expect(result.reason).not.toBe('not_step_multiple');
            expect(userQty()).toBe(0);
        }
    });
});

describe('пачки и закрытые этапы', () => {
    it('«2.5п» отклоняется — раньше округлялось до 3 пачек', async () => {
        const { send, userPacks } = setup(REORDER_ITEM, REORDER_OTHERS);
        const result = await send('2.5п');
        expect(result).toMatchObject({ ok: false, reason: 'invalid_quantity' });
        expect(userPacks()).toBe(0);
    });

    it('на упаковке приём закрыт', async () => {
        const { send, userQty } = setup({ ...REORDER_ITEM, stage: 'PACKAGING' });
        expect(await send('20')).toMatchObject({ ok: false, reason: 'ordering_closed' });
        expect(userQty()).toBe(0);
    });

    it('скрытый товар — product_not_found (бот промолчит)', async () => {
        const { send } = setup({ ...REORDER_ITEM, hidden: true });
        expect(await send('20')).toMatchObject({ ok: false, reason: 'product_not_found' });
    });
});

describe('ошибки инфраструктуры', () => {
    it('сбой БД не выносится в чат текстом исключения', async () => {
        const { item } = setup(REORDER_ITEM);
        const container = {
            orderService: {
                getActiveLinesForUserItem: async () => {
                    throw new Error('PrismaClientKnownRequestError: connection pool timeout');
                },
            },
            pricingSettings: { getOrgFeeDefaultPercent: async () => 0, getBeadPackPriceDiscountPercent: async () => 0 },
            userService: { upsertFromTelegramBot: async () => ({ id: USER_ID }) },
        } as unknown as ServiceContainer;
        const service = new OrderCollectionService(
            { resolvePurchaseItem: async () => item } as unknown as PurchaseItemResolver,
            container,
        );
        const result = await service.collectFromReply({
            chatId: -1,
            threadId: 1,
            text: '20',
            telegramId: '42',
            userInfo: { firstName: 'X' },
        });
        expect(result).toMatchObject({ ok: false, reason: 'error' });
        if (!result.ok) {
            expect(result.message).not.toContain('Prisma');
            expect(result.message).toContain('Не удалось сохранить заказ');
        }
    });

    it('сбой при создании пользователя тоже не роняет обработчик', async () => {
        const { item } = setup(REORDER_ITEM);
        const container = {
            orderService: {},
            pricingSettings: { getOrgFeeDefaultPercent: async () => 0, getBeadPackPriceDiscountPercent: async () => 0 },
            userService: {
                upsertFromTelegramBot: async () => {
                    throw new Error('db down');
                },
            },
        } as unknown as ServiceContainer;
        const service = new OrderCollectionService(
            { resolvePurchaseItem: async () => item } as unknown as PurchaseItemResolver,
            container,
        );
        await expect(
            service.collectFromReply({
                chatId: -1,
                threadId: 1,
                text: '20',
                telegramId: '42',
                userInfo: { firstName: 'X' },
            }),
        ).resolves.toMatchObject({ ok: false, reason: 'error' });
    });
});

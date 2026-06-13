/**
 * OrderLine — immutable entity (одна строка заказа).
 *
 * ООП: rich entity с поведением. Все методы-мутаторы возвращают НОВЫЙ OrderLine,
 * исходный не меняется (immutable). Инварианты пула/этапа НЕ проверяются здесь —
 * их знает aggregate OrderBook (ему видны все строки).
 */
import type { PurchaseFulfillmentStatus } from '../index';
import type { OrderLineStatus, OrderLineVO } from './types';

/** Полный набор полей для создания OrderLine. */
export interface OrderLineProps {
    id: number;
    purchaseItemId: number;
    userId: number;
    quantity: number;
    amountDue: number;
    packageCount: number;
    status: OrderLineStatus;
    createdOnStage: PurchaseFulfillmentStatus;
    baseQuantity: number | null;
    /**
     * Замороженный снимок packageCount из COLLECTION.
     * null — заморозки не было (supplement-строка) или строка ещё на COLLECTION.
     * Устанавливается атомарно с baseQuantity в freeze() при COLLECTION→REORDER.
     */
    basePackageCount: number | null;
}

export class OrderLine {
    readonly id: number;
    readonly purchaseItemId: number;
    readonly userId: number;
    readonly quantity: number;
    readonly amountDue: number;
    readonly packageCount: number;
    readonly status: OrderLineStatus;
    readonly createdOnStage: PurchaseFulfillmentStatus;
    readonly baseQuantity: number | null;
    readonly basePackageCount: number | null;

    private constructor(props: OrderLineProps) {
        this.id = props.id;
        this.purchaseItemId = props.purchaseItemId;
        this.userId = props.userId;
        this.quantity = props.quantity;
        this.amountDue = props.amountDue;
        this.packageCount = props.packageCount;
        this.status = props.status;
        this.createdOnStage = props.createdOnStage;
        this.baseQuantity = props.baseQuantity;
        this.basePackageCount = props.basePackageCount;
    }

    static create(props: OrderLineProps): OrderLine {
        return new OrderLine(props);
    }

    // ── Предикаты ──

    /** Базовая строка — создана на COLLECTION (замораживается на PAYMENT+). */
    get isBase(): boolean {
        return this.createdOnStage === 'COLLECTION';
    }

    /** Доборная строка — создана на этапе PAYMENT+. */
    get isSupplement(): boolean {
        return !this.isBase;
    }

    get isActive(): boolean {
        return this.status === 'ACTIVE';
    }

    // ── Immutable-мутаторы (возвращают новый OrderLine) ──

    /** Заморозить базовый заказ: baseQuantity := quantity, basePackageCount := packageCount. COLLECTION→REORDER. */
    freeze(): OrderLine {
        if (this.baseQuantity === this.quantity && this.basePackageCount === this.packageCount) return this;
        return new OrderLine({
            ...this,
            baseQuantity: this.quantity,
            basePackageCount: this.packageCount,
        });
    }

    /** Изменить количество + пересчитанную сумму (без проверки инвариантов). */
    withQuantity(quantity: number, amountDue: number): OrderLine {
        if (quantity === this.quantity && amountDue === this.amountDue) return this;
        return new OrderLine({ ...this, quantity, amountDue });
    }

    /**
     * Обнулить количество и сумму, сохранив упаковки и baseQuantity.
     * Используется, когда qty → 0, но на строке ещё есть упаковки.
     */
    zeroQtyKeepPackages(): OrderLine {
        if (this.quantity === 0 && this.amountDue === 0) return this;
        return new OrderLine({ ...this, quantity: 0, amountDue: 0 });
    }

    /** Обновить количество упаковок (COLLECTION/REORDER). */
    withPackageCount(packageCount: number): OrderLine {
        if (packageCount === this.packageCount) return this;
        return new OrderLine({ ...this, packageCount });
    }

    // ── Interop с OrderLineVO (для существующих функций агрегации/пула) ──

    toVO(): OrderLineVO {
        return {
            id: this.id,
            purchaseItemId: this.purchaseItemId,
            userId: this.userId,
            quantity: this.quantity,
            amountDue: this.amountDue,
            packageCount: this.packageCount,
            status: this.status,
            createdOnStage: this.createdOnStage,
            baseQuantity: this.baseQuantity,
            basePackageCount: this.basePackageCount,
        };
    }
}

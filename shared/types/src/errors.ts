/** Base application error with machine-readable code and human-readable message */
export class AppError extends Error {
    public readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

/** Resource not found */
export class NotFoundError extends AppError {
    constructor(resource: string, id?: string | number) {
        super('NOT_FOUND', id != null ? `${resource} #${id} не найден` : `${resource} не найден`);
    }
}

/** Input validation failed */
export class ValidationError extends AppError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message);
    }
}

/** Business rule violation (base) */
export class BusinessRuleError extends AppError {
    constructor(code: string, message: string) {
        super(code, message);
    }
}

/** Attempt to order more than available stock */
export class InsufficientStockError extends BusinessRuleError {
    public readonly available: number;
    public readonly requested: number;

    constructor(available: number, requested: number) {
        super('INSUFFICIENT_STOCK', `Свободный остаток: ${available}. Нельзя заказать ${requested}`);
        this.available = available;
        this.requested = requested;
    }
}

/** Purchase is not in a status that allows ordering */
export class PurchaseNotActiveError extends BusinessRuleError {
    constructor(status: string) {
        super('PURCHASE_NOT_ACTIVE', `Закупка в статусе "${status}" — заказы не принимаются`);
    }
}

/** Payment status transition is invalid */
export class InvalidPaymentTransitionError extends BusinessRuleError {
    constructor(from: string, to: string) {
        super('INVALID_PAYMENT_TRANS', `Нельзя перевести платёж из "${from}" в "${to}"`);
    }
}

/** User does not own the requested resource */
export class ForbiddenError extends AppError {
    constructor(message = 'Нет доступа к этому ресурсу') {
        super('FORBIDDEN', message);
    }
}

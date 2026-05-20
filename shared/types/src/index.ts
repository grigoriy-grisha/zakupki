// Shared types for the zakupki project

export type PurchaseStatus = 'DRAFT' | 'ACTIVE' | 'SUPPLEMENT' | 'CLOSED' | 'ARRIVED' | 'DONE';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активная',
    SUPPLEMENT: 'Добор',
    CLOSED: 'Закрыта',
    ARRIVED: 'Пришла',
    DONE: 'Завершена',
};

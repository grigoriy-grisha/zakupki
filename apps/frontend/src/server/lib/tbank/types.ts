export type TbankTaxation = 'osn' | 'usn_income' | 'usn_income_outcome' | 'esn' | 'patent';

export type TbankVat =
    | 'none'
    | 'vat0'
    | 'vat5'
    | 'vat7'
    | 'vat10'
    | 'vat22'
    | 'vat105'
    | 'vat107'
    | 'vat110'
    | 'vat122';

export const TBANK_TAXATIONS: readonly TbankTaxation[] = ['osn', 'usn_income', 'usn_income_outcome', 'esn', 'patent'];
export const TBANK_VATS: readonly TbankVat[] = [
    'none',
    'vat0',
    'vat5',
    'vat7',
    'vat10',
    'vat22',
    'vat105',
    'vat107',
    'vat110',
    'vat122',
];

export type TbankReceiptItem = {
    Name: string;
    /** Копейки. */
    Price: number;
    Quantity: number;
    /** Копейки. */
    Amount: number;
    Tax: TbankVat;
    PaymentMethod: 'full_prepayment' | 'prepayment' | 'advance' | 'full_payment' | 'partial_payment';
    PaymentObject: 'commodity' | 'service' | 'payment' | 'another';
    MeasurementUnit: string;
};

export type TbankReceipt = {
    FfdVersion: '1.2';
    Taxation: TbankTaxation;
    Email?: string;
    Phone?: string;
    Items: TbankReceiptItem[];
};

export type TbankInitRequest = {
    /** Копейки. */
    Amount: number;
    OrderId: string;
    Description: string;
    NotificationURL?: string;
    SuccessURL?: string;
    FailURL?: string;
    /** Формат YYYY-MM-DDTHH:MM:SS+03:00. */
    RedirectDueDate?: string;
    PayType?: 'O' | 'T';
    /** Язык платёжной формы банка: без него форма открывалась на языке браузера (английском). */
    Language?: 'ru' | 'en';
    DATA?: Record<string, string>;
    Receipt?: TbankReceipt;
};

export type TbankBaseResponse = {
    Success: boolean;
    ErrorCode: string;
    Message?: string;
    Details?: string;
    TerminalKey?: string;
};

export type TbankInitResponse = TbankBaseResponse & {
    Status?: string;
    PaymentId?: string | number;
    OrderId?: string;
    Amount?: number;
    PaymentURL?: string;
};

export type TbankGetStateResponse = TbankBaseResponse & {
    Status?: string;
    PaymentId?: string | number;
    OrderId?: string;
    Amount?: number;
};

export type TbankCancelResponse = TbankBaseResponse & {
    Status?: string;
    PaymentId?: string | number;
    /** Сумма платежа до возврата, копейки. */
    OriginalAmount?: number;
    /** Сумма платежа после возврата, копейки. */
    NewAmount?: number;
};

export type TbankGetQrResponse = TbankBaseResponse & {
    PaymentId?: string | number;
    Data?: string;
};

/** Финальные успешные статусы. */
export const TBANK_PAID_STATUSES = new Set(['CONFIRMED']);
/** Финальные неуспешные статусы (деньги не списаны или возвращены). */
export const TBANK_FAILED_STATUSES = new Set(['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED', 'AUTH_FAIL', 'REVERSED']);
/** Платёж ещё не начат клиентом — его можно безопасно отменить. */
export const TBANK_CANCELABLE_STATUSES = new Set(['NEW', 'FORM_SHOWED']);

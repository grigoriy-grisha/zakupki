import { request as httpsRequest } from 'node:https';
import { rootCertificates } from 'node:tls';

import { createLogger } from '@zakupki/logger';

import { RUSSIAN_TRUSTED_ROOT_CA } from './russian-trusted-root-ca';
import { signTbank, verifyTbankToken } from './token';
import type {
    TbankBaseResponse,
    TbankCancelResponse,
    TbankGetQrResponse,
    TbankGetStateResponse,
    TbankInitRequest,
    TbankInitResponse,
    TbankReceipt,
} from './types';

const log = createLogger('tbank-client');

const DEFAULT_API_URL = 'https://securepay.tinkoff.ru/v2';
const REQUEST_TIMEOUT_MS = 15_000;

export class TbankApiError extends Error {
    constructor(
        message: string,
        readonly errorCode: string,
        readonly details?: string,
    ) {
        super(message);
        this.name = 'TbankApiError';
    }
}

export type TbankConfig = {
    terminalKey: string;
    password: string;
    apiUrl: string;
};

function readTbankConfig(): TbankConfig | null {
    const terminalKey = process.env.TBANK_TERMINAL_KEY?.trim();
    const password = process.env.TBANK_PASSWORD?.trim();
    if (!terminalKey || !password) return null;
    const apiUrl = (process.env.TBANK_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
    return { terminalKey, password, apiUrl };
}

/** Тонкий клиент API интернет-эквайринга Т-Банка (v2). */
export class TbankClient {
    constructor(private readonly config: TbankConfig) {}

    get terminalKey(): string {
        return this.config.terminalKey;
    }

    init(request: TbankInitRequest): Promise<TbankInitResponse> {
        return this.call<TbankInitResponse>('Init', { ...request });
    }

    getState(paymentId: string): Promise<TbankGetStateResponse> {
        return this.call<TbankGetStateResponse>('GetState', { PaymentId: paymentId });
    }

    /** Ссылка СБП (qr.nspk.ru) для платежа — открывает выбор банка на телефоне. */
    getSbpPayload(paymentId: string): Promise<TbankGetQrResponse> {
        return this.call<TbankGetQrResponse>('GetQr', {
            PaymentId: paymentId,
            DataType: 'PAYLOAD',
            PaymentMethod: 'SBP',
        });
    }

    cancel(paymentId: string): Promise<TbankGetStateResponse> {
        return this.call<TbankGetStateResponse>('Cancel', { PaymentId: paymentId });
    }

    /** Возврат по оплаченному платежу: всей суммы или части (`amount` в копейках) с чеком возврата. */
    refund(paymentId: string, amount: number, receipt?: TbankReceipt): Promise<TbankCancelResponse> {
        return this.call<TbankCancelResponse>('Cancel', {
            PaymentId: paymentId,
            Amount: amount,
            ...(receipt ? { Receipt: receipt } : {}),
        });
    }

    verifyNotification(body: Record<string, unknown>): boolean {
        if (body.TerminalKey !== this.config.terminalKey) return false;
        return verifyTbankToken(body, this.config.password);
    }

    private async call<T extends TbankBaseResponse>(method: string, params: Record<string, unknown>): Promise<T> {
        const payload: Record<string, unknown> = { TerminalKey: this.config.terminalKey, ...params };
        payload.Token = signTbank(payload, this.config.password);

        const { status, body } = await postJson(`${this.config.apiUrl}/${method}`, payload);
        if (status < 200 || status >= 300) {
            throw new TbankApiError(`Т-Банк ответил HTTP ${status}`, String(status));
        }
        const data = JSON.parse(body) as T;
        if (!data.Success || (data.ErrorCode && data.ErrorCode !== '0')) {
            log.warn(
                { method, errorCode: data.ErrorCode, message: data.Message, details: data.Details },
                'tbank error',
            );
            throw new TbankApiError(
                data.Message || 'Ошибка платёжного сервиса',
                data.ErrorCode ?? 'unknown',
                data.Details,
            );
        }
        return data;
    }
}

/** Системные корни + корневой УЦ Минцифры (им подписан securepay.tinkoff.ru). */
const TRUSTED_CA = [...rootCertificates, RUSSIAN_TRUSTED_ROOT_CA];

function postJson(url: string, payload: unknown): Promise<{ status: number; body: string }> {
    const data = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = httpsRequest(
            url,
            {
                method: 'POST',
                ca: TRUSTED_CA,
                timeout: REQUEST_TIMEOUT_MS,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () =>
                    resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
                );
                res.on('error', reject);
            },
        );
        req.on('timeout', () => req.destroy(new Error('Т-Банк не ответил вовремя')));
        req.on('error', reject);
        req.end(data);
    });
}

let cached: TbankClient | null | undefined;

/** Клиент из env; null, если ключи терминала не заданы. */
export function getTbankClient(): TbankClient | null {
    if (cached === undefined) {
        const config = readTbankConfig();
        cached = config ? new TbankClient(config) : null;
    }
    return cached;
}

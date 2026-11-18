import { createHash } from 'node:crypto';

/**
 * Подпись запроса/уведомления Т-Банка.
 *
 * Берутся только скалярные параметры корневого уровня (вложенные Receipt/DATA и сам Token исключаются),
 * добавляется Password, ключи сортируются по алфавиту, значения конкатенируются и хешируются SHA-256.
 */
export function signTbank(params: Record<string, unknown>, password: string): string {
    const pairs: Array<[string, string]> = [['Password', password]];
    for (const [key, value] of Object.entries(params)) {
        if (key === 'Token' || value === undefined || value === null) continue;
        if (typeof value === 'object') continue;
        pairs.push([key, String(value)]);
    }
    pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const concatenated = pairs.map(([, v]) => v).join('');
    return createHash('sha256').update(concatenated, 'utf8').digest('hex');
}

export function verifyTbankToken(params: Record<string, unknown>, password: string): boolean {
    const token = params.Token;
    if (typeof token !== 'string' || token.length === 0) return false;
    return signTbank(params, password).toLowerCase() === token.toLowerCase();
}

/**
 * Допустимые MIME-типы подтверждения оплаты (чеков) и карта расширение → MIME.
 * Единый источник правды для бота (`pay.ts`) и `BotPaymentService`.
 */
export const PROOF_MIME_TYPES: ReadonlySet<string> = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
]);

export const PROOF_MIME_BY_EXT: Readonly<Record<string, string>> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
};

import { AppError } from '@zakupki/types';

/**
 * Текст ошибки для клиента: наши бизнес-ошибки (AppError) показываем как есть,
 * всё остальное (сбои БД, сети, банка) — общим текстом, без технических деталей.
 */
export function userErrorMessage(err: unknown, fallback: string): string {
    return err instanceof AppError ? err.message : fallback;
}

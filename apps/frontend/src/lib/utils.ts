import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Безопасное приведение unknown → number.
 * NaN и Infinity считаются «нет значения» и заменяются на 0 (или переданный fallback).
 * Используется при работе с Prisma Decimal / nullable-полями, которые
 * могут прийти как null/undefined.
 */
export function safeNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


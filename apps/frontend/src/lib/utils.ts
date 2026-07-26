import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge by default treats every `text-*` class as a text-color class.
 * Our custom typography utilities (`text-12-semibold`, `text-14-medium`, …)
 * set font-size + font-weight instead, so twMerge wrongly drops a real
 * `text-white` whenever both are passed — e.g. the orange "Добавить" button
 * lost its white text and inherited black. We register each typography
 * utility as its own class group so colour and typography can coexist.
 */
const typographySizes = ['11', '12', '13', '14', '16', '18', '20', '24', '30', '36', '48'];
const typographyWeights = ['regular', 'medium', 'semibold', 'bold'];
const typographyClasses = typographySizes.flatMap((size) =>
    typographyWeights.map((weight) => `text-${size}-${weight}`),
);

const twMergeConfig = extendTailwindMerge<'typography'>({
    extend: {
        classGroups: {
            typography: typographyClasses,
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMergeConfig(clsx(inputs));
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


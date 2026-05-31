/**
 * Returns the number of full days remaining until the deadline.
 * Negative values mean the deadline has passed.
 */
export function daysLeftUntil(deadline: string | Date): number {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a deadline date as a short Russian string, e.g. «15 мая».
 */
export function formatDeadlineShort(deadline: string | Date): string {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/**
 * Format a deadline date with full month name, e.g. «15 мая».
 */
export function formatDeadlineLong(deadline: string | Date): string {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

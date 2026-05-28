// Profile refresh
export const PROFILE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

// Telegram limits
export const TELEGRAM_CAPTION_MAX = 1024;
export const TELEGRAM_MESSAGE_MAX = 4096;

// Payment statuses
export const PAYMENT_STATUS: Record<string, { emoji: string; label: string }> = {
    PENDING: { emoji: '⏳', label: 'Ожидает проверки' },
    CONFIRMED: { emoji: '✅', label: 'Подтверждено' },
    REJECTED: { emoji: '❌', label: 'Отклонено' },
};

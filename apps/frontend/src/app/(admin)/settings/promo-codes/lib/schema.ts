import { z } from 'zod';

export const promoCodeSchema = z.object({
    code: z.string().min(1, 'Код обязателен').max(50),
    label: z.string().optional(),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().positive('Значение должно быть положительным'),
    purchaseId: z.number().optional(),
    maxUses: z.number().int().positive().optional(),
    minAmount: z.number().positive().optional(),
    expiresAt: z.string().optional(),
});

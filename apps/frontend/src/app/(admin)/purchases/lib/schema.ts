import { z } from 'zod';

export const newPurchaseSchema = z.object({
    tag: z.string().min(1, 'Тег обязателен'),
});

export type NewPurchaseValues = z.infer<typeof newPurchaseSchema>;

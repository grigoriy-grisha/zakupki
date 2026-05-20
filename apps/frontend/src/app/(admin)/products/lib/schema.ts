import { z } from 'zod';

export const productSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    description: z.string().optional(),
    unitId: z.coerce.number().positive('Выберите единицу'),
    pricePerUnit: z.coerce.number().positive('Цена должна быть положительной'),
    brand: z.string().optional(),
    sku: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

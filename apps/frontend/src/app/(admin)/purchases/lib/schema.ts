import { z } from 'zod';

export const newPurchaseSchema = z.object({
    tag: z.string().min(1, 'Тег обязателен'),
    supplier: z.string().min(1, 'Поставщик обязателен'),
    minAmount: z.number().positive('Мин. сумма должна быть положительной'),
    deadline: z.date({ required_error: 'Выберите дедлайн' }),
});

export const addPaymentSchema = z.object({
    userId: z.coerce.number().positive('Введите ID пользователя'),
    amount: z.coerce.number().positive('Введите сумму'),
    note: z.string().optional(),
});

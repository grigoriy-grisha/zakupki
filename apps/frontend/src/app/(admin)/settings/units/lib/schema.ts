import { z } from 'zod';

export const unitSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    shortName: z.string().min(1, 'Краткое название обязательно'),
    multiplicity: z.number().positive('Кратность должна быть положительной'),
});

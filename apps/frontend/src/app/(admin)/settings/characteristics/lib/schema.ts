import { z } from 'zod';

export const characteristicSchema = z.object({
    name: z.string().trim().min(1, 'Укажите название'),
});

export type CharacteristicFormValues = z.infer<typeof characteristicSchema>;

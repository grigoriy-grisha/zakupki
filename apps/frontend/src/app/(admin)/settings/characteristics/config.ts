import { z } from 'zod';
import type { FormFieldConfig } from '../shared/crud-form-dialog';

export const characteristicSchema = z.object({
    name: z.string().trim().min(1, 'Укажите название'),
});

export type CharacteristicFormValues = z.infer<typeof characteristicSchema>;

export const characteristicFields: FormFieldConfig[] = [
    {
        name: 'name',
        label: 'Название',
        placeholder: 'Введите название характеристики',
    },
];

export const characteristicMessages = {
    createSuccess: 'Характеристика создана',
    updateSuccess: 'Характеристика обновлена',
    deleteSuccess: 'Характеристика удалена',
};

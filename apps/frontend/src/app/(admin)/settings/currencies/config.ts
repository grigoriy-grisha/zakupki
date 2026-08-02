import { z } from 'zod';
import type { FormFieldConfig } from '../shared/crud-form-dialog';

export const currencySchema = z.object({
    name: z.string().trim().min(1, 'Укажите название').max(120, 'Не более 120 символов'),
    code: z.string().trim().max(10, 'Не более 10 символов').optional().or(z.literal('')),
    symbol: z.string().trim().max(10, 'Не более 10 символов').optional().or(z.literal('')),
});

export type CurrencyFormValues = z.infer<typeof currencySchema>;

export const currencyFields: FormFieldConfig[] = [
    {
        name: 'name',
        label: 'Название',
        placeholder: 'Например: Юань, Доллар',
    },
    {
        name: 'code',
        label: 'Код',
        placeholder: 'CNY, USD — необязательно',
    },
    {
        name: 'symbol',
        label: 'Символ',
        placeholder: '¥, $ — необязательно',
    },
];

export const currencyMessages = {
    createSuccess: 'Валюта создана',
    updateSuccess: 'Валюта обновлена',
    deleteSuccess: 'Валюта удалена',
};

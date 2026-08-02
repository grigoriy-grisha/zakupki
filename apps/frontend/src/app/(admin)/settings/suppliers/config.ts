import { z } from 'zod';
import type { FormFieldConfig } from '../shared/crud-form-dialog';

export const supplierSchema = z.object({
    name: z.string().trim().min(1, 'Укажите название').max(120, 'Не более 120 символов'),
    contact: z.string().trim().max(200, 'Не более 200 символов').optional().or(z.literal('')),
    notes: z.string().trim().max(2000, 'Не более 2000 символов').optional().or(z.literal('')),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const supplierFields: FormFieldConfig[] = [
    {
        name: 'name',
        label: 'Название',
        placeholder: 'Например: Поставщик 1',
    },
    {
        name: 'contact',
        label: 'Контакт',
        placeholder: 'Телеграм, телефон, email — что угодно для связи',
    },
    {
        name: 'notes',
        label: 'Заметки',
        placeholder: 'Любые комментарии (не показываются участникам)',
    },
];

export const supplierMessages = {
    createSuccess: 'Поставщик создан',
    updateSuccess: 'Поставщик обновлён',
    deleteSuccess: 'Поставщик удалён',
};

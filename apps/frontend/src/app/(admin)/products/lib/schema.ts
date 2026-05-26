import { z } from 'zod';

export const PACKAGE_UNITS = ['гр', 'шт', 'туба'] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

export const priceTierSchema = z.object({
    amount: z.coerce.number().positive('Укажите количество'),
    unit: z.string().min(1, 'Выберите ед.'),
    price: z.coerce.number().nonnegative('Цена не может быть отрицательной'),
});
export type PriceTierValues = z.infer<typeof priceTierSchema>;

export const productSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    description: z.string().optional(),
    unitId: z.coerce.number().positive('Выберите единицу'),
    categoryId: z.number().nullable(),
    minPackageAmount: z.number().positive('Укажите фасовку').nullable(),
    minPackageUnit: z.string().nullable(),
    priceTiers: z.array(priceTierSchema).min(1, 'Укажите хотя бы одну цену'),
    supplierPackageAmount: z.number().positive().nullable(),
    supplierPackageUnit: z.string().nullable(),
    supplierPackagePrice: z.number().nonnegative().nullable(),
    availableAmount: z.number().nonnegative().nullable(),
    availableUnit: z.string().nullable(),
});

export const categorySchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    parentId: z.number().nullable().optional(),
});

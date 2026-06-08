import { z } from 'zod';
import { UNITS } from '@zakupki/types';

export const UNIT_CODES = UNITS.map((u) => u.code) as [string, ...string[]];
export const PACKAGE_UNITS = UNITS.map((u) => u.shortName) as [string, ...string[]];
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

export const priceTierSchema = z.object({
    amount: z.coerce.number().positive('Укажите количество'),
    unit: z.string().min(1, 'Выберите ед.'),
    price: z.coerce.number().nonnegative('Цена не может быть отрицательной'),
});
export type PriceTierValues = z.infer<typeof priceTierSchema>;

/** Schema for creating a product */
export const productCreateSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    articleNumber: z.string().optional(),
    unitCode: z.string().min(1, 'Выберите единицу учёта'),
    pricePerUnit: z.number().nonnegative().optional(),
    priceTiers: z.array(priceTierSchema).optional(),
    minPackageAmount: z.number().positive().nullable().optional(),
    minPackageUnit: z.string().nullable().optional(),
    supplierPackageAmount: z.number().positive().nullable().optional(),
    supplierPackageUnit: z.string().nullable().optional(),
    supplierPackagePrice: z.number().nonnegative().nullable().optional(),
    supplierPackageTiers: z.array(priceTierSchema).nullable().optional(),
    supplementStep: z.number().positive().nullable().optional(),
    referenceStock: z.number().nonnegative().nullable().optional(),
    referenceStockUnit: z.string().nullable().optional(),
});

export type ProductCreateFormValues = z.infer<typeof productCreateSchema>;

/** Full product fields (prices, description) — for use outside catalog sheet */
export const productSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    articleNumber: z.string().optional(),
    description: z.string().optional(),
    unitCode: z.string().min(1, 'Выберите единицу'),
    minPackageAmount: z.number().positive('Укажите фасовку').nullable(),
    minPackageUnit: z.string().nullable(),
    priceTiers: z.array(priceTierSchema).min(1, 'Укажите хотя бы одну цену'),
    supplierPackageAmount: z.number().positive().nullable(),
    supplierPackageUnit: z.string().nullable(),
    supplierPackagePrice: z.number().nonnegative().nullable(),
    supplementStep: z.number().positive().nullable(),
    referenceStock: z.number().nonnegative().nullable(),
    referenceStockUnit: z.string().nullable(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const productAttributeSchema = z.object({
    name: z.string().trim().min(1, 'Название обязательно'),
});

export type ProductAttributeFormValues = z.infer<typeof productAttributeSchema>;

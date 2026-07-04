import { z } from 'zod';
import { UNITS } from '@zakupki/types';

export const UNIT_CODES = UNITS.map((u) => u.code) as [string, ...string[]];
export const PACKAGE_UNITS = UNITS.map((u) => u.shortName) as [string, ...string[]];
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

/**
 * Schema for creating a product in the catalog.
 * Цены, тиры и фасовка задаются отдельно — при добавлении товара в закупку
 * (через PurchaseProductEditForm / product-picker-dialog → ProductDetail).
 */
export const productCreateSchema = z.object({
    name: z.string().min(1, 'Название обязательно'),
    articleNumber: z.string().optional(),
    unitCode: z.string().min(1, 'Выберите единицу учёта'),
    pricePerUnit: z.number().nonnegative().optional(),
});

export type ProductCreateFormValues = z.infer<typeof productCreateSchema>;

export const productAttributeSchema = z.object({
    name: z.string().trim().min(1, 'Название обязательно'),
});

export type ProductAttributeFormValues = z.infer<typeof productAttributeSchema>;

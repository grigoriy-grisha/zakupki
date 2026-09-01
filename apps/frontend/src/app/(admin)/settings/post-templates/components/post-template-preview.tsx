'use client';

import { Eye } from 'lucide-react';
import { useMemo } from 'react';

import { type DescriptionFields,postTemplateEngine } from '@/lib/product-description';

const SAMPLE_FIELDS: DescriptionFields = {
    name: 'Metallic Blue Iris',
    articleNumber: 'DBSC0005',
    brandName: 'Miyuki',
    titleAttributes: ['Miyuki'],
    attributeNames: ['Delica 11/0'],
    productCharacteristics: [
        { name: 'Цвет', value: 'Синий ирис' },
        { name: 'Размер', value: '11/0' },
    ],
    minPackageAmount: 5,
    minPackageUnit: 'гр',
    supplierLimit: 45,
    supplierLimitUnit: 'гр',
    supplierName: 'Поставщик 1',
    purchaseTag: 'TEST1',
    pricePerPackCurrency: 12.5,
    currencyName: 'Доллар',
    packAmount: 50,
    packUnit: 'гр',
    orgFeePercent: 10,
    unitPriceRub: 22,
};

export function PostTemplatePreview({ body }: { body: string }) {
    const html = useMemo(() => postTemplateEngine.apply(body, SAMPLE_FIELDS), [body]);

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-1.5 text-12-regular text-fg-secondary">
                <Eye className="size-3.5 shrink-0" />
                Превью на примере товара
            </div>
            <div className="min-h-40 flex-1 rounded-lg border bg-bg-soft/40 p-3 text-14-regular leading-relaxed">
                {html ? (
                    <div
                        className="[&_p:not(:first-child)]:mt-2 [&_p]:min-h-4 [&_strong]:font-semibold [&_u]:underline"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                ) : (
                    <p className="text-fg-secondary">Шаблон пуст</p>
                )}
            </div>
        </div>
    );
}

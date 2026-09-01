'use client';

import { CrudFormDialog } from '../../shared/crud-form-dialog';
import { currencyFields, type CurrencyFormValues,currencySchema } from '../config';
import { useCreateCurrency, useUpdateCurrency } from '../hooks/use-currencies';

interface CurrencyFormDialogProps {
    mode: 'create' | 'edit';
    item?: { id: number; name: string; code?: string | null; symbol?: string | null };
}

export function CurrencyFormDialog({ mode, item }: CurrencyFormDialogProps) {
    const createMutation = useCreateCurrency();
    const updateMutation = useUpdateCurrency();

    const defaultValues: CurrencyFormValues = {
        name: item?.name ?? '',
        code: item?.code ?? '',
        symbol: item?.symbol ?? '',
    };

    return (
        <CrudFormDialog<CurrencyFormValues>
            mode={mode}
            item={item as { id: number } & CurrencyFormValues | undefined}
            fields={currencyFields}
            schema={currencySchema}
            defaultValues={defaultValues}
            createTitle="Новая валюта"
            editTitle="Редактировать валюту"
            createButtonLabel="Добавить валюту"
            createMutation={createMutation}
            updateMutation={updateMutation}
        />
    );
}

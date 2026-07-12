'use client';

import { CrudFormDialog } from '../../shared/crud-form-dialog';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/use-suppliers';
import { supplierFields, supplierSchema, type SupplierFormValues } from '../config';

interface SupplierFormDialogProps {
    mode: 'create' | 'edit';
    item?: { id: number; name: string; contact?: string | null; notes?: string | null };
}

export function SupplierFormDialog({ mode, item }: SupplierFormDialogProps) {
    const createMutation = useCreateSupplier();
    const updateMutation = useUpdateSupplier();

    const defaultValues: SupplierFormValues = {
        name: item?.name ?? '',
        contact: item?.contact ?? '',
        notes: item?.notes ?? '',
    };

    return (
        <CrudFormDialog<SupplierFormValues>
            mode={mode}
            item={item as { id: number } & SupplierFormValues | undefined}
            fields={supplierFields}
            schema={supplierSchema}
            defaultValues={defaultValues}
            createTitle="Новый поставщик"
            editTitle="Редактировать поставщика"
            createButtonLabel="Добавить поставщика"
            createMutation={createMutation}
            updateMutation={updateMutation}
        />
    );
}

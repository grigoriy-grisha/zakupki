'use client';

import { useDeleteSupplier, useSupplierList } from './hooks';
import { SupplierFormDialog } from './components';
import { SimpleCrudTable } from '../shared/simple-crud-table';

export function SuppliersTab() {
    const { data: items, isLoading } = useSupplierList();
    const deleteMutation = useDeleteSupplier();

    return (
        <SimpleCrudTable
            items={(items ?? []) as { id: number; name: string }[]}
            isLoading={isLoading}
            deleteMutation={deleteMutation}
            renderEdit={(item) => <SupplierFormDialog mode="edit" item={item} />}
            renderCreate={() => <SupplierFormDialog mode="create" />}
            emptyText="Поставщиков пока нет"
            deleteTitle="Удалить поставщика"
        />
    );
}

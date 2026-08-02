'use client';

import { SimpleCrudTable } from '../shared/simple-crud-table';
import { SupplierFormDialog } from './components/supplier-form-dialog';
import { useDeleteSupplier, useSupplierList } from './hooks/use-suppliers';

export interface SupplierRow {
    id: number;
    name: string;
    contact: string | null;
    notes: string | null;
    position: number;
    _count: { items: number };
}

export function SuppliersTab() {
    const { data: items, isLoading } = useSupplierList();
    const deleteMutation = useDeleteSupplier();

    const rows = (items ?? []) as SupplierRow[];

    return (
        <SimpleCrudTable<SupplierRow>
            items={rows}
            isLoading={isLoading}
            deleteMutation={deleteMutation}
            renderEdit={(item) => <SupplierFormDialog mode="edit" item={item} />}
            renderCreate={() => <SupplierFormDialog mode="create" />}
            emptyText="Поставщиков пока нет"
            deleteTitle="Удалить поставщика"
            renderDeleteDescription={(item) => (
                <>
                    Удалить <strong>{item.name}</strong>?
                    {item._count.items > 0 && (
                        <>
                            {' '}
                            Сейчас привязан к {item._count.items}{' '}
                            {item._count.items === 1 ? 'позиции' : 'позициям'} закупок — сначала переназначьте или
                            удалите их.
                        </>
                    )}
                </>
            )}
            extraColumns={[
                {
                    header: 'Контакт',
                    render: (item) => item.contact || <span className="text-fg-tertiary">—</span>,
                },
                {
                    header: 'В закупках',
                    render: (item) => item._count.items,
                },
            ]}
        />
    );
}

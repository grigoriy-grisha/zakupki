'use client';

import { useCharacteristicList, useDeleteCharacteristic } from './hooks';
import { CharacteristicFormDialog } from './components';
import { SimpleCrudTable } from '../shared/simple-crud-table';

export function CharacteristicsTab() {
    const { data: items, isLoading } = useCharacteristicList();
    const deleteMutation = useDeleteCharacteristic();

    return (
        <SimpleCrudTable
            items={items as { id: number; name: string }[] | undefined}
            isLoading={isLoading}
            deleteMutation={deleteMutation}
            renderEdit={(item) => <CharacteristicFormDialog mode="edit" item={item} />}
            renderCreate={() => <CharacteristicFormDialog mode="create" />}
            emptyText="Характеристик пока нет"
            deleteTitle="Удалить характеристику"
            renderDeleteDescription={(item) => (
                <>
                    Удалить <strong>{item.name}</strong>? Связь с типами атрибутов и значения у товаров
                    будут удалены.
                </>
            )}
        />
    );
}

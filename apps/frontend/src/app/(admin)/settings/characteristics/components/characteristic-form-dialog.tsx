'use client';

import { CrudFormDialog } from '../../shared/crud-form-dialog';
import { useCreateCharacteristic, useUpdateCharacteristic } from '../hooks/use-characteristics';
import { characteristicFields, characteristicSchema, type CharacteristicFormValues } from '../config';

interface CharacteristicFormDialogProps {
    mode: 'create' | 'edit';
    item?: { id: number; name: string };
}

export function CharacteristicFormDialog({ mode, item }: CharacteristicFormDialogProps) {
    const createMutation = useCreateCharacteristic();
    const updateMutation = useUpdateCharacteristic();

    return (
        <CrudFormDialog<CharacteristicFormValues>
            mode={mode}
            item={item}
            fields={characteristicFields}
            schema={characteristicSchema}
            defaultValues={{ name: '' }}
            createTitle="Новая характеристика"
            editTitle="Редактировать характеристику"
            createButtonLabel="Добавить характеристику"
            createMutation={createMutation}
            updateMutation={updateMutation}
        />
    );
}

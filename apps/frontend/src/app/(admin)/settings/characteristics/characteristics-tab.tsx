'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useCharacteristicList, useDeleteCharacteristic, useMoveCharacteristic } from './hooks';
import { CharacteristicFormDialog } from './components';

export function CharacteristicsTab() {
    const { data: items, isLoading } = useCharacteristicList();
    const deleteMutation = useDeleteCharacteristic();
    const moveMutation = useMoveCharacteristic();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-4">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Справочник характеристик для товаров. Порядок строк задаёт порядок по умолчанию; у каждого
                    значения в справочниках товаров можно уточнить порядок отдельно.
                </p>
                <CharacteristicFormDialog mode="create" />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20 text-center">Порядок</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-24 text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    Характеристик пока нет
                                </TableCell>
                            </TableRow>
                        )}
                        {items?.map((item, index) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={index === 0 || moveMutation.isPending}
                                            title="Выше"
                                            onClick={() => moveMutation.mutate({ id: item.id, direction: 'up' })}
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={
                                                index === (items?.length ?? 0) - 1 || moveMutation.isPending
                                            }
                                            title="Ниже"
                                            onClick={() => moveMutation.mutate({ id: item.id, direction: 'down' })}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <CharacteristicFormDialog mode="edit" item={item} />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Удалить характеристику"
                description={
                    <>
                        Удалить <strong>{deleteTarget?.name}</strong>? Связь с типами атрибутов и значения у товаров
                        будут удалены.
                    </>
                }
                onConfirm={() => {
                    if (!deleteTarget) return;
                    deleteMutation.mutate(
                        { id: deleteTarget.id },
                        { onSuccess: () => setDeleteTarget(null) },
                    );
                }}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}

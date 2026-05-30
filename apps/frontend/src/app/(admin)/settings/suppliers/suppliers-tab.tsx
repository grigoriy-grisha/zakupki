'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

import { SupplierFormDialog } from './components';
import { useDeleteSupplier, useSupplierList } from './hooks';

export function SuppliersTab() {
    const { data: items, isLoading } = useSupplierList();
    const deleteMutation = useDeleteSupplier();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-start justify-between gap-4">
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Справочник поставщиков для закупок. При создании закупки можно выбрать поставщика из
                    списка.
                </p>
                <SupplierFormDialog mode="create" />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-24 text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                    Поставщиков пока нет
                                </TableCell>
                            </TableRow>
                        )}
                        {((items ?? []) as { id: number; name: string }[]).map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <SupplierFormDialog mode="edit" item={item} />
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
                title="Удалить поставщика"
                description={
                    <>
                        Удалить <strong>{deleteTarget?.name}</strong>?
                    </>
                }
                onConfirm={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}


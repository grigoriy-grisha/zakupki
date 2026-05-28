'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
    type ProductAttributeKind,
    PRODUCT_ATTRIBUTE_KIND_LABELS,
} from '@/app/(admin)/products/lib/schema';
import { useProductAttributeList, useDeleteProductAttribute } from '../hooks';
import { AttributeFormDialog } from './attribute-form-dialog';

export function AttributeKindPanel({ kind }: { kind: ProductAttributeKind }) {
    const { data: items, isLoading, isError, error } = useProductAttributeList(kind);
    const deleteMutation = useDeleteProductAttribute();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    if (isError) {
        return (
            <div className="py-8 text-center text-destructive text-sm">
                Не удалось загрузить справочник: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {items?.length ?? 0} значений · {PRODUCT_ATTRIBUTE_KIND_LABELS[kind]}
                </p>
                <AttributeFormDialog kind={kind} mode="create" />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead className="w-28 text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                    Пока нет значений
                                </TableCell>
                            </TableRow>
                        )}
                        {items?.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-center gap-1">
                                        <AttributeFormDialog kind={kind} mode="edit" item={item} />
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
                title="Удалить значение"
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

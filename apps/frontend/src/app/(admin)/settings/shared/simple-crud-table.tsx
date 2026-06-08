'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

export interface ExtraColumn<T> {
    header: string;
    render: (item: T) => ReactNode;
    className?: string;
}

interface SimpleCrudTableProps<T extends { id: number; name: string }> {
    items: T[] | undefined;
    isLoading: boolean;
    deleteMutation: { mutate: (input: { id: number }, opts?: { onSuccess?: () => void }) => void; isPending: boolean };
    renderEdit: (item: T) => ReactNode;
    renderCreate: () => ReactNode;
    emptyText: string;
    deleteTitle?: string;
    renderDeleteDescription?: (item: T) => ReactNode;
    extraColumns?: ExtraColumn<T>[];
    children?: ReactNode;
}

export function SimpleCrudTable<T extends { id: number; name: string }>({
    items,
    isLoading,
    deleteMutation,
    renderEdit,
    renderCreate,
    emptyText,
    deleteTitle = 'Удалить',
    renderDeleteDescription,
    extraColumns,
}: SimpleCrudTableProps<T>) {
    const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{items?.length ?? 0} записей</p>
                {renderCreate()}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            {extraColumns?.map((col) => (
                                <TableHead key={col.header} className={col.className}>
                                    {col.header}
                                </TableHead>
                            ))}
                            <TableHead className="w-24 text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items?.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={2 + (extraColumns?.length ?? 0)}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyText}
                                </TableCell>
                            </TableRow>
                        )}
                        {items?.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                {extraColumns?.map((col) => (
                                    <TableCell key={col.header} className={col.className}>
                                        {col.render(item)}
                                    </TableCell>
                                ))}
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        {renderEdit(item)}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget(item)}
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
                title={deleteTitle}
                description={
                    deleteTarget
                        ? renderDeleteDescription
                            ? renderDeleteDescription(deleteTarget)
                            : <>Удалить <strong>{deleteTarget.name}</strong>?</>
                        : ''
                }
                onConfirm={() => {
                    if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id }, { onSuccess: () => setDeleteTarget(null) });
                }}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}

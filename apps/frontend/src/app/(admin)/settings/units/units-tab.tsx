'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useUnitList, useDeleteUnit } from './hooks';
import { UnitFormDialog } from './components';

export function UnitsTab() {
    const { data: units, isLoading } = useUnitList();
    const deleteMutation = useDeleteUnit();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{units?.length ?? 0} единиц</p>
                <UnitFormDialog mode="create" />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead>Краткое</TableHead>
                            <TableHead className="text-center">Кратность</TableHead>
                            <TableHead className="text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {units?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    Единиц пока нет
                                </TableCell>
                            </TableRow>
                        )}
                        {units?.map((unit) => (
                            <TableRow key={unit.id}>
                                <TableCell className="font-medium">{unit.name}</TableCell>
                                <TableCell className="text-muted-foreground">{unit.shortName}</TableCell>
                                <TableCell className="text-center">
                                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
                                        {Number(unit.multiplicity)}
                                    </code>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <UnitFormDialog mode="edit" unit={unit} />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget({ id: unit.id, name: unit.name })}
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
                title="Удалить единицу"
                description={
                    <>
                        Удалить единицу <strong>{deleteTarget?.name}</strong>?
                    </>
                }
                onConfirm={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}

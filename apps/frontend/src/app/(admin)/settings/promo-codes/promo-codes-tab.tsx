'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { type PromoCodeData,PromoCodeDialog, PromoCodeRow } from './components';
import { useDeletePromoCode,usePromoCodesList } from './hooks';

export function PromoCodesTab() {
    const { data: promoCodes, isLoading } = usePromoCodesList();
    const deleteMutation = useDeletePromoCode();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; code: string } | null>(null);

    return (
        <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{promoCodes?.length ?? 0} промокодов</p>
                {!isLoading && <PromoCodeDialog />}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Код</TableHead>
                            <TableHead>Описание</TableHead>
                            <TableHead>Тип</TableHead>
                            <TableHead>Значение</TableHead>
                            <TableHead>Закупка</TableHead>
                            <TableHead className="text-center">Использований</TableHead>
                            <TableHead>Мин. сумма</TableHead>
                            <TableHead>Действует до</TableHead>
                            <TableHead className="text-center">Статус</TableHead>
                            <TableHead className="text-center">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Загрузка...
                                </TableCell>
                            </TableRow>
                        )}
                        {promoCodes?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Промокодов пока нет
                                </TableCell>
                            </TableRow>
                        )}
                        {promoCodes?.map((promo: PromoCodeData) => (
                            <PromoCodeRow key={promo.id} promo={promo} onDelete={setDeleteTarget} />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Удалить промокод"
                description={
                    <>
                        Удалить промокод{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">
                            {deleteTarget?.code}
                        </code>
                        ?
                    </>
                }
                onConfirm={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}

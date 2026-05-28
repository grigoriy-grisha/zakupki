'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { CircleCheck, CircleX, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTogglePromoCode } from '../hooks';
import { getPromoStatus } from '../lib';
interface PromoCodeRowProps {
    promo: {
        id: number;
        code: string;
        label: string | null;
        type: 'PERCENT' | 'FIXED';
        value: string | number;
        purchase: unknown;
        usedCount: number;
        maxUses: number | null;
        minAmount: string | null;
        expiresAt: string | null;
        isActive: boolean;
    };
    onDelete: (promo: { id: number; code: string }) => void;
}

export function PromoCodeRow({ promo, onDelete }: PromoCodeRowProps) {
    const toggleMutation = useTogglePromoCode();
    const purchase = promo.purchase as any;
    const status = getPromoStatus(promo);

    return (
        <TableRow key={promo.id}>
            <TableCell>
                <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono font-semibold">{promo.code}</code>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{promo.label || '—'}</TableCell>
            <TableCell>
                <Badge variant="outline">{promo.type === 'PERCENT' ? 'Процент' : 'Фикс. сумма'}</Badge>
            </TableCell>
            <TableCell className="font-medium">
                {promo.type === 'PERCENT'
                    ? `${Number(promo.value)}%`
                    : `${Number(promo.value).toLocaleString('ru-RU')} ₽`}
            </TableCell>
            <TableCell className="text-sm">{purchase ? `${purchase.tag} — ${purchase.supplier}` : 'Любая'}</TableCell>
            <TableCell className="text-center text-sm">
                {promo.usedCount}
                {promo.maxUses ? `/${promo.maxUses}` : ''}
            </TableCell>
            <TableCell className="text-sm">
                {promo.minAmount ? `${Number(promo.minAmount).toLocaleString('ru-RU')} ₽` : '—'}
            </TableCell>
            <TableCell className="text-sm">
                {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString('ru-RU') : 'Бессрочно'}
            </TableCell>
            <TableCell className="text-center">
                <Badge className={status.className}>{status.label}</Badge>
            </TableCell>
            <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-8 w-8 p-0',
                            promo.isActive ? 'text-error hover:bg-error-50' : 'text-success hover:bg-success-50',
                        )}
                        onClick={() => toggleMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                        disabled={toggleMutation.isPending}
                    >
                        {promo.isActive ? <CircleX className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete({ id: promo.id, code: promo.code })}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
